import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolResultPages, TOOL_RESULT_PAGE_CHARS, textPage } from '../runtime/tool-result-pages.js';
import { createAdministratorToolResults } from '../../xiaobai-os/apps/administrator/agent/tool-results.ts';
import { safePromptJson } from '../../xiaobai-os/capabilities/maintenance/prompt-safety.js';
import { createAdministratorToolExecutor } from '../../xiaobai-os/apps/administrator/agent/tool-executor.ts';

// 验收：分页必须无损还原原结果，错误状态不能变成功；代价：证据丢失、错误结论。
// 验收：继续读取不复制整份正文，过期与非法位置明确失败；代价：内存失控、串读证据。
for (const [name, create, serialize] of [
    ['core', () => createToolResultPages({ budgetChars: 1_000_000 }), JSON.stringify],
    ['administrator', createAdministratorToolResults, safePromptJson],
]) {
    test(`${name}: bounded source remains fully readable page by page and in receipt slices`, () => {
        const pages = create();
        const result = { ok: false, status: 'partial', data: { text: '网页证据😀\n'.repeat(220000), failures: ['not_found'] } };
        let page = pages.project('source', result, { boundedSource: true }).data;
        let restored = page.text;
        let index = 0;
        while (page.nextOffset !== null) {
            assert.ok(page.text.length <= TOOL_RESULT_PAGE_CHARS);
            const id = `page-${++index}`;
            page = pages.page(id, 'source', page.nextOffset);
            assert.equal(pages.read(id).text, page.text);
            restored += page.text;
        }
        assert.equal(restored, serialize(result));
        assert.equal(JSON.parse(restored).ok, false);
        assert.deepEqual(pages.read('source'), textPage(serialize(result)));
        pages.project('replacement', result, { boundedSource: true });
        assert.throws(() => pages.read('source'), /expired/);
        assert.throws(() => pages.read('page-1'), /expired/);
        for (const offset of [-1, 0.5, '0', null, Infinity, serialize(result).length + 1]) {
            assert.throws(() => pages.page('bad', 'replacement', offset), /range_invalid/);
        }
    });
}

test('page boundaries preserve surrogate pairs and oversized unbounded results are explicitly unavailable', () => {
    const text = 'a'.repeat(TOOL_RESULT_PAGE_CHARS - 1) + '😀tail';
    const first = textPage(text);
    assert.equal(first.text + textPage(text, first.nextOffset).text, text);
    assert.equal(first.text.isWellFormed(), true);
    const pages = createToolResultPages({ budgetChars: TOOL_RESULT_PAGE_CHARS });
    const small = { ok: true, status: 'read', data: 'short' };
    assert.equal(pages.project('small', small), small);
    const failure = pages.project('large', { ok: false, status: 'failed', data: text });
    assert.equal(failure.ok, false);
    assert.equal(failure.detailsUnavailable, 'result_exceeds_evidence_budget');
    assert.throws(() => pages.read('large'), /tool_result_expired/);
});

test('clearing a result owner revokes both original references and retained page ranges', () => {
    const pages = createToolResultPages({ budgetChars: TOOL_RESULT_PAGE_CHARS * 3 });
    const result = { ok: true, text: 'x'.repeat(TOOL_RESULT_PAGE_CHARS * 2) };
    pages.project('source', result);
    pages.page('part', 'source', 10);
    pages.clear();
    for (const reference of ['source', 'part']) assert.throws(() => pages.read(reference), { code: 'tool_result_expired' });
    const replacement = pages.project('next', result);
    assert.equal(replacement.data.reference, 'next');
    assert.deepEqual(pages.read('next'), textPage(JSON.stringify(result)));
});

test('administrator executor keeps its partial receipt and reads retained web pages without another network request', async t => {
    let requests = 0;
    const url = 'https://example.com/reference';
    t.mock.method(globalThis, 'fetch', async () => {
        requests++;
        return Response.json({ results: [{ url, raw_content: 'Reference facts. '.repeat(90000) + 'END_MARKER' }],
            failed_results: [{ url: 'https://example.org/missing', error: 'not found' }] });
    });
    const operations = [];
    const executor = await createAdministratorToolExecutor({
        registry: { list: () => [] }, operations, webConfig: { tavilyApiKey: 'fixture-only' },
        reader: { info: {}, identity: {}, assertCurrent() {}, staleEvidence: () => ({ floors: [], missingFloors: [] }) },
        readEnvironment: () => ({}), guard: () => true, onChange() {}, async saveReceipts() {},
    });
    const first = await executor.execute('web_fetch', { urls: [url, 'https://example.org/missing'] }, 'fetch', 0);
    assert.equal(first.status, 'partial');
    assert.equal(first.receipt.status, 'partial');
    assert.ok(first.data.text.length <= TOOL_RESULT_PAGE_CHARS);
    const tail = await executor.execute('ToolResultRead', { reference: first.data.reference, offset: first.data.totalChars - 1000 }, 'page', 1);
    assert.equal(tail.ok, true);
    assert.equal(tail.data.nextOffset, null);
    assert.ok(tail.data.text.includes('END_MARKER'));
    assert.ok(tail.data.text.includes('not found'));
    assert.equal(requests, 1);
    assert.deepEqual(operations.map(operation => operation.status), ['partial', 'read']);
});
