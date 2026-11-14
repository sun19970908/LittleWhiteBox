// Build-artifact acceptance: source-only tests cannot prove the shipped runtime exposes
// the public facade or keeps its replay helpers in the same browser dependency graph.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';

async function loadShippedCore() {
    const manifest = JSON.parse(await readFile(new URL('../../../dist/manifest.json', import.meta.url), 'utf8'));
    const entry = new URL(`../../../dist/${manifest.entries['runtime/agent-core'].file}`, import.meta.url);
    // eslint-disable-next-line no-unsanitized/method -- Entry is from the repository's generated build manifest.
    return import(entry.href);
}

test('the shipped Agent entry supports caller-owned replay and host invalidation', async () => {
    const core = await loadShippedCore();
    const settings = core.normalizeAgentSettings({
        provider: 'google',
        model: 'fixture', apiKey: '', maxTokens: 512,
    });
    let enabled = true;
    let loads = 0;
    const sent = [];
    const payload = { googleContents: [{ role: 'model', parts: [{
        functionCall: { name: 'record', args: { value: 1 } }, thoughtSignature: 'fixture-signature',
    }] }] };
    const { api, cancelAll } = core.createPublicAgentApi({
        isEnabled: () => enabled,
        loadSettings: () => { loads++; return structuredClone(settings); },
        loadCore: async () => ({ createAgentAdapter: () => ({ async chat(task) {
            sent.push(task);
            return sent.length === 1 ? {
                text: '', completion: 'complete', finishReason: 'STOP', truncated: false,
                toolCalls: [{ id: 'local-1', providerId: '', name: 'record', arguments: '{"value":1}' }],
                providerPayload: payload,
            } : { text: 'done', toolCalls: [], completion: 'complete', finishReason: 'STOP', truncated: false };
        } }) }),
    });
    const session = await api.openSession({ api: 'main' });
    // This external tool protocol must also be reachable from the shipped entry, not only source imports.
    assert.deepEqual(session.web.getTools().map(tool => tool.function.name), ['web_search', 'web_fetch', 'ToolResultRead']);
    assert.throws(() => session.web.read({ reference: 'unavailable' }), { code: 'tool_result_expired' });
    const tools = [{ type: 'function', function: { name: 'record', parameters: { type: 'object' } } }];
    const messages = [{ role: 'user', content: 'fixture' }];
    const first = await session.chat({ messages, tools });
    assert.equal(sent.length, 1);
    assert.equal(first.toolCalls[0].providerId, '');
    messages.push(JSON.parse(JSON.stringify(first.reply)), session.toolResult(first.toolCalls[0], false));
    const second = await session.chat({ messages, tools });
    assert.equal(second.text, 'done');
    assert.equal(sent.length, 2);
    assert.equal(loads, 1);
    assert.equal(sent[1].maxTokens, 512);
    assert.deepEqual(sent[1].messages[1].providerPayload, payload);
    assert.equal(sent[1].messages[1].tool_calls[0].providerToolCallId, '');
    assert.deepEqual(JSON.parse(sent[1].messages[2].content), { result: false });
    assert.equal(Object.hasOwn(first, 'requestInspection'), false);
    enabled = false;
    cancelAll();
    await assert.rejects(session.chat({ messages }), { code: 'AGENT_DISABLED' });
    assert.equal((await api.getStatus()).enabled, false);
    enabled = true;
    const next = await api.openSession({ api: 'main' });
    next.dispose();
    await assert.rejects(next.chat({ messages }), { code: 'AGENT_SESSION_DISPOSED' });
});

// Contract: the installed runtime must send the same verified model protocol as
// source, through its bundled SDKs (cost: rejected or incorrectly billed requests).
test('shipped SDKs send current model controls over the actual HTTP wire', async t => {
    const core = await loadShippedCore();
    const requests = [];
    const server = createServer((request, response) => {
        const respond = async () => {
            let raw = '';
            for await (const chunk of request) raw += chunk;
            requests.push({ body: JSON.parse(raw), headers: request.headers });
            const body = request.url.includes(':generateContent')
                ? { candidates: [{ content: { role: 'model', parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] }
                : request.url.includes('/messages')
                    ? { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'fixture',
                        content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn',
                        usage: { input_tokens: 1, output_tokens: 1 } }
                    : { id: 'resp_fixture', object: 'response', status: 'completed', model: 'fixture',
                        output: [{ type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed',
                            content: [{ type: 'output_text', text: 'OK', annotations: [] }] }] };
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(body));
        };
        respond().catch(error => response.destroy(error));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const cases = [
        { provider: 'google', model: 'gemini-4-hydrogen', reasoning: { mode: 'on', effort: 'xhigh' }, check({ body }) {
            assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'XHIGH');
            assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, undefined);
        } },
        { provider: 'google', model: 'gemini-2.5-flash', reasoning: { mode: 'on', budgetTokens: 2048 }, check({ body }) {
            assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 2048);
            assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, undefined);
        } },
        { provider: 'anthropic', model: 'deepseek-chat', reasoning: { mode: 'on', effort: 'high' }, check({ body, headers }) {
            assert.equal(body.thinking.type, 'adaptive');
            assert.equal(body.output_config.effort, 'high');
            assert.equal(body.top_p, 0.83);
            assert.equal(body.top_k, 37);
            assert.equal(body.temperature, undefined);
            assert.equal(headers['x-api-key'], 'offline-fixture');
            assert.equal(headers.authorization, undefined);
            assert.equal(headers['anthropic-version'], '2023-06-01');
        } },
        { provider: 'anthropic', model: 'claude-opus-5-5', reasoning: { mode: 'on', effort: 'xhigh' }, check({ body }) {
            assert.equal(body.thinking.type, 'adaptive');
            assert.equal(body.output_config.effort, 'xhigh');
            assert.equal(body.temperature, undefined);
        } },
        { provider: 'openai-responses', model: 'gpt-6-astra', reasoning: { mode: 'on', effort: 'max' }, check({ body }) {
            assert.equal(body.reasoning.effort, 'max');
            assert.equal(body.temperature, undefined);
        } },
    ];
    for (const { provider, model, reasoning, check } of cases) {
        await t.test(`${provider}/${model}`, async () => {
            const adapter = core.createAgentAdapter({ provider, model, baseUrl, apiKey: 'offline-fixture', timeoutMs: 3000,
                sampling: { topP: { enabled: true, value: 0.83 }, topK: { enabled: true, value: 37 } } });
            const result = await adapter.chat({ messages: [{ role: 'user', content: 'offline' }],
                maxTokens: 8192, temperature: 0.2, reasoning });
            assert.equal(result.text, 'OK');
            check(requests.at(-1));
        });
    }
    assert.equal(requests.length, cases.length);
});
