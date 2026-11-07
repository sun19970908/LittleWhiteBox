import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAgentAdapter } from '../provider-config.js';
import { createVertexStreamAccumulator } from '../adapters/vertex-stream.js';
import { resolveRuntimeReasoning } from '../reasoning-capabilities.js';
import { buildProviderAssistantToolCallMessage, buildProviderToolResultMessage } from '../runtime/protocol.js';
import { normalizeAgentConfig } from '../config.js';
import { resolveActiveProviderConfig } from '../provider-resolution.js';
import { pullModelsForProvider } from '../model-list.js';
import { createPreset } from '../../text-api/model.js';
import { resolveConnection } from '../../text-api/runtime.js';

// Acceptance contracts:
// - Opaque model IDs, relay prefixes, keys and saved main/delegate settings reach the
//   selected destination unchanged; no Cloud auth or retries (credential / money risk).
// - Official partialArgs become exact arguments and signed replay in live/cold tool
//   rounds, including same-name/id-less calls (protocol / unintended writes risk).
// - Incomplete, aborted or malformed streams never return executable calls (data loss).
// - Current Vertex reasoning excludes rejected/ignored parameters, independent of
//   aliases, and ordinary complete calls/AIS streams retain their existing contract.
const relay = { provider: 'google-vertex', baseUrl: 'https://vertex-fixture.invalid/proxy', apiKey: 'fixture-key',
    model: 'gemini-4-argon（别名 / 高速）?x&y#z', vertex: { authMode: 'relay' } };
const tool = { type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: {} } } };
const chunk = (functionCall, extra = {}) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall, ...extra }] } }] });
const done = { candidates: [{ finishReason: 'STOP' }] };
const sse = chunks => new Response(chunks.map(value => `data: ${JSON.stringify(value)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const complete = { candidates: [{ content: { role: 'model', parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] };
const compiledCore = createRequire(import.meta.url)('../../../server-plugin/littlewhitebox-server/tests/runtime-fixture.js').bundle.agentCore;

function fragments(id) {
    return [
        chunk({ ...(id ? { id } : {}), name: 'lookup', partialArgs: [{ jsonPath: '$.brightness', numberValue: 50 }], willContinue: true }, { thoughtSignature: 'signed-first' }),
        chunk({ args: null, partialArgs: [{ jsonPath: '$.colorTemperature', stringValue: 'warm', willContinue: true }], willContinue: true }),
        chunk({ partialArgs: [{ jsonPath: '$.colorTemperature' }], willContinue: true }),
        chunk({}), done,
    ];
}

const replayCases = [['source', createAgentAdapter], ['backend build', compiledCore.createAgentAdapter]]
    .flatMap(([runtime, factory]) => ['', 'provider-call'].map(id => ({ runtime, factory, id })));
for (const { runtime, factory, id } of replayCases) {
    test(`${runtime}: relay fragments preserve arguments, signatures, order and ${id ? 'real' : 'omitted'} IDs across live/cold replay`, async t => {
        const sent = [];
        t.mock.method(globalThis, 'fetch', async (input, options) => {
            const url = new URL(input);
            assert.equal(url.hostname, 'vertex-fixture.invalid');
            assert.equal(decodeURIComponent(url.pathname), `/proxy/v1beta/models/${relay.model}:${sent.length ? 'generateContent' : 'streamGenerateContent'}`);
            assert.equal(new Headers(options.headers).get('x-goog-api-key'), relay.apiKey);
            assert.equal(new Headers(options.headers).has('authorization'), false);
            sent.push(JSON.parse(options.body));
            return sent.length === 1 ? sse(fragments(id)) : json(complete);
        });
        const adapter = factory(relay);
        const user = { role: 'user', content: 'fixture' };
        const progress = [];
        const first = await adapter.chat({ messages: [user], tools: [tool], reasoning: { mode: 'on', effort: 'medium' },
            onStreamProgress: value => progress.push(structuredClone(value)) });
        assert.equal(sent[0].toolConfig.functionCallingConfig.streamFunctionCallArguments, true);
        assert.equal(sent[0].generationConfig.thinkingConfig.thinkingLevel, 'MEDIUM');
        assert.deepEqual(JSON.parse(first.toolCalls[0].arguments), { brightness: 50, colorTemperature: 'warm' });
        assert.equal(first.toolCalls[0].providerId, id);
        assert.ok(progress.some(value => value.toolCallDraft));
        const expectedPart = { thoughtSignature: 'signed-first', functionCall: { ...(id ? { id } : {}), name: 'lookup', args: { brightness: 50, colorTemperature: 'warm' } } };
        assert.deepEqual(first.providerPayload.googleContent.parts, [expectedPart]);
        await adapter.chat({ toolResponses: [{ ...first.toolCalls[0], response: { found: true } }] });
        const assistant = buildProviderAssistantToolCallMessage(first, first.toolCalls);
        const result = buildProviderToolResultMessage({ toolCallId: first.toolCalls[0].id, toolName: 'lookup', content: '{"found":true}' });
        await factory(relay).chat({ messages: JSON.parse(JSON.stringify([user, assistant, result])), tools: [tool] });
        for (const body of sent.slice(1)) {
            const parts = body.contents.flatMap(content => content.parts);
            assert.deepEqual(parts.filter(part => part.functionCall), [expectedPart]);
            assert.deepEqual(parts.find(part => part.functionResponse).functionResponse,
                { ...(id ? { id } : {}), name: 'lookup', response: { found: true } });
            assert.equal(JSON.stringify(body).includes('partialArgs'), false);
            assert.equal(body.toolConfig.functionCallingConfig.streamFunctionCallArguments, undefined);
        }
        assert.equal(JSON.stringify(first.requestInspection).includes(relay.apiKey), false);
    });
}

test('nested typed fragments, escaped paths and consecutive same-name calls stay distinct', () => {
    const stream = createVertexStreamAccumulator('local');
    stream.append(chunk({ name: 'lookup', willContinue: true, partialArgs: [
        { jsonPath: '$.rows[0].value', stringValue: '你', willContinue: true },
        { jsonPath: '$.rows[0].ok', boolValue: false },
        { jsonPath: '$.rows[1]', nullValue: 'NULL_VALUE' },
        { jsonPath: '$["key.with.dot"]', numberValue: 0 },
        { jsonPath: '$.__proto__.fixture', stringValue: 'own-data' },
    ] }));
    stream.append(chunk({ partialArgs: [{ jsonPath: '$.rows[0].value', stringValue: '好' }] }));
    stream.append(chunk({ name: 'lookup', willContinue: true }));
    stream.append(chunk({ partialArgs: [{ jsonPath: '$.location', stringValue: 'second' }] }));
    const result = stream.finish();
    const first = JSON.parse(result.toolCalls[0].arguments);
    assert.deepEqual(first.rows, [{ value: '你好', ok: false }, null]);
    assert.equal(first['key.with.dot'], 0);
    assert.equal(Object.getPrototypeOf(first).fixture, undefined);
    assert.equal(first.__proto__.fixture, 'own-data');
    assert.notEqual(result.toolCalls[0].id, result.toolCalls[1].id);
    assert.deepEqual(JSON.parse(result.toolCalls[1].arguments), { location: 'second' });
    assert.equal(result.content.parts.length, 2);
});

test('unfinished calls, strings and invalid fragment paths never become executable arguments', () => {
    for (const item of [
        { name: 'lookup', willContinue: true },
        { name: 'lookup', partialArgs: [{ jsonPath: '$.text', stringValue: 'part', willContinue: true }] },
        { name: 'lookup', partialArgs: [{ jsonPath: '$..invalid', numberValue: 2 }] },
        { name: 'lookup', partialArgs: [{ jsonPath: '$.text' }] },
    ]) {
        const stream = createVertexStreamAccumulator('local');
        assert.throws(() => { stream.append(chunk(item)); stream.finish(); }, { code: /^VERTEX_TOOL_STREAM_/ });
    }
});

test('stream EOF, cancellation and HTTP errors fail without retries or executable results', async t => {
    let calls = 0;
    const controller = new AbortController();
    t.mock.method(globalThis, 'fetch', async () => { calls++; return sse([chunk({ name: 'lookup', willContinue: true })]); });
    await assert.rejects(createAgentAdapter(relay).chat({ messages: [{ role: 'user', content: 'x' }], tools: [tool], onStreamProgress() {} }), { code: 'VERTEX_TOOL_STREAM_INCOMPLETE' });
    controller.abort();
    await assert.rejects(createAgentAdapter(relay).chat({ messages: [{ role: 'user', content: 'x' }], signal: controller.signal, onStreamProgress() {} }), { name: 'AbortError' });
    assert.equal(calls, 1);
    // HTTP error, not merely an error-shaped successful response.
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{"error":{"message":"unavailable"}}', { status: 503 }); });
    await assert.rejects(createAgentAdapter(relay).chat({ messages: [{ role: 'user', content: 'x' }] }));
    assert.equal(calls, 2);
});

test('HTTP 200 stream errors after completed tools propagate and cancel the reader', async t => {
    let cancelled = false;
    const encoder = new TextEncoder();
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk({ name: 'lookup', args: {} }))}\r\n\r\n`));
        controller.enqueue(encoder.encode('data: {"error":{"code":503,"status":"UNAVAILABLE","message":"fixture-error"}}\r\n\r\n'));
    }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    await assert.rejects(createAgentAdapter(relay).chat({ messages: [{ role: 'user', content: 'x' }], tools: [tool], onStreamProgress() {} }),
        error => error.code === 503 && error.message === 'fixture-error' && error.status === undefined);
    assert.equal(cancelled, true);
});

test('network byte boundaries, UTF-8 and empty terminators preserve signed same-name parallel calls', async t => {
    const bytes = new TextEncoder().encode([
        chunk({ name: 'lookup', id: 'one', willContinue: true }, { thoughtSignature: 's1' }),
        chunk({ partialArgs: [{ jsonPath: '$.text', stringValue: '你好' }] }),
        chunk({ name: 'lookup', willContinue: true }, { thoughtSignature: 's2' }),
        chunk({ partialArgs: [{ jsonPath: '$.text', stringValue: 'second', willContinue: true }], willContinue: true }),
        chunk({ partialArgs: [{ jsonPath: '$.text', stringValue: '' }], willContinue: true }), chunk({}), done,
    ].map(value => `data: ${JSON.stringify(value)}\r\n\r\n`).join(''));
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
        for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3));
        controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    const result = await createAgentAdapter(relay).chat({ messages: [{ role: 'user', content: 'x' }], tools: [tool], onStreamProgress() {} });
    assert.deepEqual(result.toolCalls.map(call => JSON.parse(call.arguments)), [{ text: '你好' }, { text: 'second' }]);
    assert.deepEqual(result.providerPayload.googleContent.parts.map(part => part.thoughtSignature), ['s1', 's2']);
});

test('current Vertex controls are alias-independent and do not send unsupported sampling or budgets', async t => {
    const bodies = [];
    t.mock.method(globalThis, 'fetch', async (_input, options) => { bodies.push(JSON.parse(options.body)); return json(complete); });
    for (const model of ['gemini-3.8-flash', 'gemini-4-argon', '任意别名']) {
        const config = { ...relay, model, sampling: { topP: { enabled: true, value: 0.2 }, frequencyPenalty: { enabled: true, value: 1 }, presencePenalty: { enabled: true, value: 1 } } };
        await createAgentAdapter(config).chat({ messages: [{ role: 'user', content: 'x' }], temperature: 0.5, maxTokens: 70000, reasoning: { mode: 'on' } });
        assert.deepEqual(bodies.at(-1).generationConfig, { maxOutputTokens: 70000, thinkingConfig: { includeThoughts: true, thinkingLevel: 'MEDIUM' } });
        assert.equal(resolveRuntimeReasoning(config, { mode: 'on', effort: 'minimal' }).valid, false);
        assert.equal(resolveRuntimeReasoning(config, { mode: 'off' }).valid, false);
    }
});

test('relay URL, credentials, flags and opaque model discovery survive main/delegate/text presets', async t => {
    const config = { ...relay, vertex: { authMode: 'relay', streamFunctionCallArguments: false } };
    const saved = normalizeAgentConfig({ presets: { main: { provider: config.provider, modelConfigs: { [config.provider]: config } } },
        currentPresetName: 'main', delegateConfig: { provider: config.provider, modelConfigs: { [config.provider]: { ...config, baseUrl: 'https://delegate.invalid' } } } });
    const restored = normalizeAgentConfig(JSON.parse(JSON.stringify(saved)));
    assert.equal(resolveActiveProviderConfig(restored).baseUrl, relay.baseUrl);
    assert.equal(resolveActiveProviderConfig(restored).vertex.streamFunctionCallArguments, false);
    assert.equal(resolveActiveProviderConfig(restored, { role: 'delegate' }).baseUrl, 'https://delegate.invalid');
    const text = resolveConnection(createPreset('x', 'x', { ...config, prefixMode: 'custom', customPrefix: '/gateway' }));
    assert.equal(text.resolvedBaseUrl, relay.baseUrl + '/gateway');
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(String(url), relay.baseUrl + '/gateway/models');
        assert.equal(options.headers['x-goog-api-key'], relay.apiKey);
        return json({ models: [{ name: 'models/随便命名' }, { name: 'models/gemini-4-argon（旗舰）' }] });
    });
    assert.deepEqual(await pullModelsForProvider(text), ['随便命名', 'gemini-4-argon（旗舰）']);
});

test('disabling argument streaming still accepts ordinary complete tool calls', async t => {
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        assert.equal(JSON.parse(options.body).toolConfig.functionCallingConfig.streamFunctionCallArguments, undefined);
        return sse([chunk({ name: 'lookup', args: { complete: true } }), done]);
    });
    const result = await createAgentAdapter({ ...relay, vertex: { authMode: 'relay', streamFunctionCallArguments: false } }).chat({
        messages: [{ role: 'user', content: 'x' }], tools: [tool], onStreamProgress() {},
    });
    assert.deepEqual(JSON.parse(result.toolCalls[0].arguments), { complete: true });
});
