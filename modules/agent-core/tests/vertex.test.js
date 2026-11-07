import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createAgentAdapter } from '../provider-config.js';
import { normalizeAgentConfig } from '../config.js';
import { resolveActiveProviderConfig } from '../provider-resolution.js';
import { buildProviderAssistantToolCallMessage, buildProviderToolResultMessage } from '../runtime/protocol.js';
import { redactRequestSecrets } from '../adapters/request-inspection.js';
import { pullModelsForProvider } from '../model-list.js';
import { createVertexAuth } from '../adapters/vertex-auth.js';
import { resolveVertexEndpoint } from '../vertex-config.js';
import { createPreset } from '../../text-api/model.js';
import { resolveConnection, connectionError } from '../../text-api/runtime.js';
import { assertPlannerPresetReady } from '../../ena-planner/ena-planner-api-config.js';

// Acceptance contracts (credentials / money / protocol / saved configuration):
// - Both runtimes use the selected Vertex account, never host/ambient credentials.
// - Parameters, images, signed tool calls and cold-start tool replies survive the wire.
// - OAuth signs for Google's fixed endpoint; keys/assertions/tokens stay out of diagnostics.
// - Cancellation/expiry stop or refresh only the current adapter's token; no generation retry.
// - Main/delegate/preset switches preserve their own auth and backend handoff fields.

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { type: 'service_account', project_id: 'vertex-fixture', client_email: 'test@vertex-fixture.iam.gserviceaccount.com',
    private_key: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), token_uri: 'https://never-contact.invalid/token' };
const standard = { provider: 'google-vertex', model: 'gemini-3.8-flash', apiKey: 'unused-key', baseUrl: 'https://never-contact.invalid',
    vertex: { authMode: 'service-account', location: 'global', projectId: '', serviceAccountJson: JSON.stringify(account) } };
const express = { ...standard, apiKey: 'express-fixture', vertex: { authMode: 'api-key' } };
const tool = { type: 'function', function: { name: 'lookup', description: 'Look up an item.', parameters: { type: 'object', properties: {} } } };
const response = parts => ({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const compiled = await build({ entryPoints: ['modules/agent-core/provider-config.js'], bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent' });
// eslint-disable-next-line no-unsanitized/method -- Trusted first-party browser build, compiled in memory.
const browser = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const nodeBundle = createRequire(import.meta.url)('../../../server-plugin/littlewhitebox-server/tests/runtime-fixture.js').bundle.agentCore;

for (const [runtime, factory] of [['node', createAgentAdapter], ['browser', browser.createAgentAdapter], ['backend build', nodeBundle.createAgentAdapter]]) {
    for (const config of [standard, express]) {
        test(`${runtime}: ${config.vertex.authMode} sends native Vertex requests and signed cold replay`, async t => {
            const requests = [];
            t.mock.method(globalThis, 'fetch', async (input, options) => {
                const url = String(input);
                if (url === 'https://oauth2.googleapis.com/token') {
                    const jwt = new URLSearchParams(options.body).get('assertion');
                    const [head, body, signature] = jwt.split('.');
                    assert.equal(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(signature, 'base64url')), true);
                    const claims = JSON.parse(Buffer.from(body, 'base64url'));
                    assert.equal(claims.aud, url); assert.equal(claims.iss, account.client_email);
                    assert.equal(claims.scope, 'https://www.googleapis.com/auth/cloud-platform');
                    assert.equal(claims.exp - claims.iat, 3600);
                    return json({ access_token: 'oauth-fixture', expires_in: 3600, token_type: 'Bearer' });
                }
                requests.push({ url, headers: new Headers(options.headers), body: JSON.parse(options.body) });
                return json(response(requests.length === 1
                    ? [{ functionCall: { name: 'lookup', args: {} }, thoughtSignature: 'signature-fixture' }]
                    : [{ text: 'OK' }]));
            });
            const adapter = factory(config);
            const messages = [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }];
            const first = await adapter.chat({ messages, tools: [tool], toolChoice: 'required', maxTokens: 321, temperature: 0.2 });
            const replay = [messages[0], buildProviderAssistantToolCallMessage(first, first.toolCalls),
                buildProviderToolResultMessage({ toolCallId: first.toolCalls[0].id, toolName: first.toolCalls[0].name, content: JSON.stringify({ found: true }) })];
            const last = await factory(config).chat({ messages: replay, tools: [tool], maxTokens: 321 });
            assert.equal(last.text, 'OK'); assert.equal(first.provider, 'google-vertex');
            const req = requests[0];
            const prefix = config.vertex.authMode === 'service-account' ? 'projects/vertex-fixture/locations/global/' : '';
            assert.equal(req.url, `https://aiplatform.googleapis.com/v1/${prefix}publishers/google/models/gemini-3.8-flash:generateContent`);
            assert.equal(req.body.generationConfig.maxOutputTokens, 321);
            assert.equal(req.body.generationConfig.temperature, undefined);
            assert.equal(req.body.toolConfig.functionCallingConfig.mode, 'ANY');
            assert.equal(req.body.contents[0].parts[1].inlineData.data, 'AA==');
            assert.equal(req.headers.get('authorization'), config.vertex.authMode === 'service-account' ? 'Bearer oauth-fixture' : null);
            assert.equal(req.headers.get('x-goog-api-key'), config.vertex.authMode === 'service-account' ? null : 'express-fixture');
            const parts = requests[1].body.contents.flatMap(content => content.parts);
            assert.equal(parts.find(part => part.functionCall).thoughtSignature, 'signature-fixture');
            assert.equal(parts.find(part => part.functionResponse).functionResponse.name, 'lookup');
            assert.equal(Object.hasOwn(parts.find(part => part.functionResponse).functionResponse, 'id'), false);
            for (const secret of ['oauth-fixture', 'express-fixture', account.private_key]) assert.equal(JSON.stringify(first.requestInspection).includes(secret), false);
        });
    }
}

test('Vertex stream/session tools preserve controls, cancellation and token lifetime', async t => {
    let tokenCalls = 0;
    const bodies = [];
    const signals = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (String(url).includes('/token')) { tokenCalls++; return json({ access_token: 'short-token', expires_in: 3600, token_type: 'Bearer' }); }
        bodies.push(JSON.parse(options.body)); signals.push(options.signal);
        const data = response(bodies.length === 1 ? [{ functionCall: { name: 'lookup', args: {} }, thoughtSignature: 'signature' }] : [{ text: 'OK' }]);
        return new Response(`data: ${JSON.stringify(data)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const adapter = createAgentAdapter(standard);
    const ctrl = new AbortController();
    const first = await adapter.chat({ messages: [{ role: 'user', content: 'hi' }], tools: [tool], maxTokens: 512, signal: ctrl.signal, onStreamProgress() {} });
    await adapter.chat({ toolResponses: [{ name: 'lookup', response: { ok: true } }], signal: ctrl.signal, onStreamProgress() {} });
    assert.equal(tokenCalls, 1); assert.equal(first.toolCalls.length, 1);
    assert.equal(bodies[1].generationConfig.maxOutputTokens, 512);
    assert.equal(bodies[1].tools[0].functionDeclarations[0].name, 'lookup');
    ctrl.abort();
    await assert.rejects(adapter.chat({ toolResponses: [{ name: 'lookup', response: {} }], signal: ctrl.signal }), { name: 'AbortError' });
    assert.equal(bodies.length, 2); assert.equal(tokenCalls, 1);
    assert.ok(signals.every(signal => signal instanceof AbortSignal));
});

test('token expiry refreshes and OAuth failure is not retried or echoed', async t => {
    let time = Date.now(); let calls = 0;
    t.mock.method(Date, 'now', () => time);
    t.mock.method(globalThis, 'fetch', async () => { calls++; return json({ access_token: `token-${calls}`, expires_in: 3600, token_type: 'Bearer' }); });
    const headers = createVertexAuth(resolveVertexEndpoint(standard));
    await headers(); await headers(); assert.equal(calls, 1);
    time += 3600_000;
    await headers(); assert.equal(calls, 2);
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(account.private_key, { status: 403 }); });
    time += 3600_000;
    await assert.rejects(headers(), error => error.status === 403 && !error.message.includes('PRIVATE KEY'));
    assert.equal(calls, 3);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(headers(controller.signal), { name: 'AbortError' }); assert.equal(calls, 3);
});

test('Vertex configuration survives main/delegate persistence without crossing providers', () => {
    const saved = normalizeAgentConfig({ currentPresetName: 'main', presets: { main: { provider: 'google-vertex', modelConfigs: {
        'google-vertex': standard, google: { model: 'separate', apiKey: 'separate-key' },
    } } }, delegateConfig: { provider: 'google-vertex', modelConfigs: { 'google-vertex': express } } });
    const restored = normalizeAgentConfig(JSON.parse(JSON.stringify(saved)));
    const main = resolveActiveProviderConfig(restored);
    const delegate = resolveActiveProviderConfig(restored, { role: 'delegate' });
    assert.equal(main.vertex.serviceAccountJson, standard.vertex.serviceAccountJson);
    assert.equal(main.apiKey, ''); assert.equal(main.baseUrl, '');
    assert.equal(delegate.vertex.authMode, 'api-key'); assert.equal(delegate.apiKey, express.apiKey);
    assert.equal(delegate.vertex.serviceAccountJson, '');
    assert.equal(restored.presets.main.modelConfigs.google.apiKey, 'separate-key');
    const safe = JSON.stringify(redactRequestSecrets({ main, delegate, private_key: account.private_key, assertion: 'jwt' }));
    for (const secret of [account.private_key, 'express-fixture', 'unused-key', 'jwt']) assert.equal(safe.includes(secret), false);
});

test('publisher model discovery uses Vertex auth and never substitutes a built-in list on failure', async t => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(new URL(url).pathname, '/v1/publishers/google/models');
        assert.equal(options.headers['x-goog-api-key'], express.apiKey);
        return json({ publisherModels: [{ name: 'publishers/google/models/gemini-2.5-flash' }, { name: 'publishers/google/models/imagen-4' }] });
    });
    assert.deepEqual(await pullModelsForProvider({ ...express, model: '' }), ['gemini-2.5-flash']);
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
    await assert.rejects(pullModelsForProvider(express), { status: 403 });
});

test('all text features accept standard Vertex without an API key and keep secrets out of errors', () => {
    const preset = createPreset('vertex', 'Vertex', { ...standard, apiKey: '' });
    assertPlannerPresetReady(preset);
    assert.equal(resolveConnection(preset).vertex.serviceAccountJson, standard.vertex.serviceAccountJson);
    const keyMode = createPreset('express', 'Express', { ...express, vertex: { ...standard.vertex, authMode: 'api-key' } });
    assert.equal(resolveConnection(keyMode).vertex.serviceAccountJson, '');
    assert.throws(() => assertPlannerPresetReady({ ...keyMode, apiKey: '' }));
    assert.throws(() => assertPlannerPresetReady({ ...preset, vertex: { serviceAccountJson: 'invalid' } }));
    const error = connectionError(new Error(`${account.private_key} ${JSON.stringify(account.private_key).slice(1, -1)}`), preset);
    assert.equal(error.message.includes('PRIVATE KEY'), false);
});

test('OAuth cancellation and deadline stop in-flight authentication before any generation', async t => {
    for (const cancel of [false, true]) {
        const controller = new AbortController();
        let calls = 0;
        t.mock.method(globalThis, 'fetch', async (_url, options) => {
            calls++;
            if (cancel) queueMicrotask(() => controller.abort());
            return new Promise((_, reject) => {
                options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
            });
        });
        const headers = createVertexAuth(resolveVertexEndpoint(standard), '', { timeoutMs: 100 });
        await assert.rejects(headers(controller.signal), { name: 'AbortError' });
        assert.equal(calls, 1);
    }
});

test('regional and multi-regional Vertex routes are explicit and reject injected destinations', () => {
    for (const [location, host] of [['us-central1', 'us-central1-aiplatform.googleapis.com'], ['us', 'aiplatform.us.rep.googleapis.com'], ['eu', 'aiplatform.eu.rep.googleapis.com']]) {
        const endpoint = resolveVertexEndpoint({ ...standard, vertex: { ...standard.vertex, location, projectId: 'target-project' } });
        assert.equal(endpoint.baseUrl, `https://${host}`);
        assert.equal(endpoint.model, `projects/target-project/locations/${location}/publishers/google/models/gemini-3.8-flash`);
    }
    assert.throws(() => resolveVertexEndpoint({ ...standard, vertex: { ...standard.vertex, location: 'global/../../evil' } }));
});
