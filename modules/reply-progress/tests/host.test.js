import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

test('reply progress loads on the ST 1.14 host surface and reads live generation flags', async t => {
    const compiled = await build({
        stdin: { contents: `export { createReplyProgressHostRuntime } from '../host.js';
            export { host } from 'reply-progress-native-host';`,
            resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
        bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
        plugins: [{ name: 'reply-progress-host-boundary', setup(builder) {
            builder.onResolve({ filter: /(?:^reply-progress-native-host$|\/(?:script|group-chats|extensions|events)\.js$)/ },
                () => ({ path: 'native', namespace: 'fixture' }));
            builder.onResolve({ filter: /^\.\/runtime\.js$/ },
                () => ({ path: 'runtime', namespace: 'fixture' }));
            builder.onLoad({ filter: /^runtime$/, namespace: 'fixture' }, () => ({
                contents: 'export const createReplyProgressRuntime = dependencies => dependencies;',
            }));
            builder.onLoad({ filter: /^native$/, namespace: 'fixture' }, () => ({ contents: `
                // Frozen ST 1.14 exports used here: no isGenerating convenience export.
                export let is_send_press = false;
                export let is_group_generating = false;
                export let online_status = 'connected';
                export let streamingProcessor = null;
                let streaming = false;
                let mainApi = 'openai';
                export const isStreamingEnabled = () => streaming;
                export const getGenerateUrl = () => '/api/backends/text-completions/generate';
                export const eventSource = { makeFirst() {}, removeListener() {} };
                export const event_types = { CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready' };
                export const getContext = () => ({ chat: [], groupId: null, mainApi });
                export const setSendButtonState = value => { is_send_press = value; };
                export const host = { send: setSendButtonState,
                    group: value => { is_group_generating = value; },
                    api: (value, useStreaming) => { mainApi = value; streaming = useStreaming; },
                    stream: value => { streamingProcessor = value; } };
            ` }));
        } }],
    });
    // eslint-disable-next-line no-unsanitized/method -- Compiled repository modules and fixed native exports only.
    const { createReplyProgressHostRuntime, host } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const nativeFetch = () => Promise.resolve({ ok: true });
    globalThis.fetch = nativeFetch;
    const dataset = {};
    globalThis.document = { body: { dataset } };
    t.after(() => {
        globalThis.fetch = previousFetch;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    const runtime = createReplyProgressHostRuntime();
    assert.equal(runtime.isGenerating(), false);
    host.send(true);
    assert.equal(runtime.isGenerating(), true);
    host.send(false);
    host.group(true);
    assert.equal(runtime.isGenerating(), true);
    host.group(false);
    assert.equal(runtime.isGenerating(), false);
    dataset.generating = 'true';
    assert.equal(runtime.isGenerating(), true);
    delete dataset.generating;
    assert.equal(runtime.isGenerating(), false);
    let requests = 0;
    const generation = { type: 'normal', previousStream: null };
    const stopChat = runtime.observeRequest(generation, () => requests++);
    assert.equal(typeof stopChat, 'function');
    stopChat();
    assert.equal(globalThis.fetch, nativeFetch);
    host.api('textgenerationwebui', false);
    assert.equal(runtime.observeRequest(generation, () => requests++), null);
    assert.equal(globalThis.fetch, nativeFetch);
    host.api('textgenerationwebui', true);
    const abortController = new AbortController();
    host.stream({ type: 'normal', abortController });
    const stopText = runtime.observeRequest(generation, () => requests++);
    try {
        await globalThis.fetch('/api/backends/text-completions/generate', {
            method: 'POST', body: '{}', signal: abortController.signal,
        });
        assert.equal(requests, 1);
    } finally { stopText(); }
    assert.equal(globalThis.fetch, nativeFetch);
});
