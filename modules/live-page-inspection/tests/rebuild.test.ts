import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withAssistantJsApiManifest } from '../../assistant/shared/extension-jsapi-manifest';
import { iframeRendererJsApiNamespace } from '../../iframe-renderer/assistant-api';
import { analyzeJavaScriptApiRequest, runJavaScriptApi } from '../../assistant/runtime-src/jsapi-runtime.js';

const manifest = withAssistantJsApiManifest(JSON.parse(await readFile(new URL('../../assistant/st-jsapi-manifest.json', import.meta.url), 'utf8')));
const code = 'const id = 0; ctx.updateMessageBlock(id, ctx.chat[id]); st.iframeRenderer.processMessageById(id); return null;';

test('existing JS tool rebuilds display without saving or publishing message events', async () => {
    const chat = [{ mes: 'unchanged', extra: { retained: true } }];
    const before = structuredClone(chat), calls: unknown[] = [];
    const ctx = {
        chat,
        updateMessageBlock: (id: number, message: unknown) => { assert.equal(message, chat[id]); calls.push(['format', id]); },
        saveChat: () => { throw new Error('Rebuild must not save chat'); },
        eventSource: { emit: () => { throw new Error('Rebuild must not publish message events'); } },
    };
    for (const managed of [false, true]) {
        calls.length = 0;
        const st = { iframeRenderer: iframeRendererJsApiNamespace((id, final) => calls.push(['render', id, final]), managed) };
        const result = await runJavaScriptApi({ code, manifest, ctx, st, purpose: 'Rebuild one display', expectedOutput: 'Completed' });
        assert.equal(result.ok, true, JSON.stringify(result.execution));
        assert.equal(result.requestKind, 'effect');
        assert.deepEqual(calls, managed ? [['format', 0]] : [['format', 0], ['render', 0, true]]);
        assert.deepEqual(chat, before);
    }
});

test('renderer registration preserves existing APIs and requires effect approval', () => {
    assert.equal(analyzeJavaScriptApiRequest({ code: 'return st.iframeRenderer.processMessageById(0);', manifest }).requestKind, 'effect');
    assert.equal(analyzeJavaScriptApiRequest({ code: 'return ctx.chat[0];', manifest }).requestKind, 'read');
    assert.equal(analyzeJavaScriptApiRequest({ code: 'return st.state3.inspect();', manifest }).requestKind, 'read');
    assert.ok(manifest.callablePaths.includes('ctx.updateMessageBlock'));
});
