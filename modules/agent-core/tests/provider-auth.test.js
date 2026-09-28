import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { build } from 'esbuild';
import { createAgentAdapter } from '../provider-config.js';
import { pullModelsForProvider } from '../ui/settings-panel.js';
import { buildProviderAssistantToolCallMessage, buildProviderToolResultMessage } from '../runtime/protocol.js';

const providers = ['openai-compatible', 'openai-responses', 'anthropic', 'google'];
const tools = [{ type: 'function', function: { name: 'ping', description: 'Ping.', parameters: { type: 'object', properties: {} } } }];
const messages = [{ role: 'user', content: 'ping' }];

const browserBuild = await build({ entryPoints: ['modules/agent-core/provider-config.js'],
    bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent' });
// Trusted first-party module compiled in memory to exercise the browser SDK exports.
// eslint-disable-next-line no-unsanitized/method
const browserCore = await import(`data:text/javascript;base64,${Buffer.from(browserBuild.outputFiles[0].text).toString('base64')}`);

// Exact SSE shapes are external provider protocols, not snapshots of implementation.
function wireResponse(provider, tool, streaming) {
    const call = { id: 'call-1', type: 'function', function: { name: 'ping', arguments: '{}' } };
    const anthropicBlock = tool ? { type: 'tool_use', id: call.id, name: 'ping', input: {} } : { type: 'text', text: 'OK' };
    const anthropic = { id: 'msg-1', type: 'message', role: 'assistant', model: 'test-model', content: [anthropicBlock],
        stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    const item = tool ? { type: 'function_call', id: 'fc-1', call_id: call.id, name: 'ping', arguments: '{}', status: 'completed' }
        : { type: 'message', id: 'msg-1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'OK', annotations: [] }] };
    const responses = { id: 'resp-1', object: 'response', status: 'completed', model: 'test-model', output: [item] };
    const google = { candidates: [{ content: { role: 'model', parts: [tool ? { functionCall: { name: 'ping', args: {} } } : { text: 'OK' }] }, finishReason: 'STOP' }] };
    const openai = { model: 'test-model', choices: [{ index: 0, message: { role: 'assistant', content: tool ? '' : 'OK', ...(tool ? { tool_calls: [call] } : {}) }, finish_reason: tool ? 'tool_calls' : 'stop' }] };
    if (!streaming) return JSON.stringify({ 'openai-compatible': openai, 'openai-responses': responses, anthropic, google }[provider]);
    const event = (data) => `${data.type ? `event: ${data.type}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
    if (provider === 'anthropic') return [
        { type: 'message_start', message: { ...anthropic, content: [], stop_reason: null } },
        { type: 'content_block_start', index: 0, content_block: tool ? anthropicBlock : { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: tool ? { type: 'input_json_delta', partial_json: '{}' } : { type: 'text_delta', text: 'OK' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: anthropic.stop_reason, stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
    ].map(event).join('');
    if (provider === 'openai-responses') return [
        { type: 'response.created', response: { ...responses, status: 'in_progress', output: [] } },
        { type: 'response.output_item.added', output_index: 0, item },
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response: responses },
    ].map(event).join('');
    if (provider === 'google') return event(google);
    return event({ model: 'test-model', choices: [{ index: 0, delta: tool ? { role: 'assistant', tool_calls: [{ ...call, index: 0 }] } : { role: 'assistant', content: 'OK' }, finish_reason: null }] })
        + event({ choices: [{ index: 0, delta: {}, finish_reason: openai.choices[0].finish_reason }] }) + 'data: [DONE]\n\n';
}

async function mockProvider(t, provider, { streaming = false, status = 200 } = {}) {
    const requests = [];
    const server = createServer(async (request, response) => {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        requests.push({ url: request.url, headers: request.headers, body: raw ? JSON.parse(raw) : null });
        if (status !== 200) {
            response.writeHead(status, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: { type: 'authentication_error', message: 'unsupported authentication', code: status } }));
        } else if (request.method === 'GET') {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ data: [{ id: 'test-model' }], models: [{ name: 'models/test-model' }] }));
        } else {
            response.writeHead(200, { 'Content-Type': streaming ? 'text/event-stream' : 'application/json' });
            response.end(wireResponse(provider, requests.length === 1, streaming));
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return { baseUrl: `http://127.0.0.1:${server.address().port}`, requests };
}

function assertAuth(headers, provider, key, redacted = false) {
    const actual = new Headers(headers);
    const expected = key && redacted ? '[redacted]' : key;
    assert.equal(actual.get('authorization'), provider.startsWith('openai-') && key ? (redacted ? expected : `Bearer ${key}`) : null);
    assert.equal(actual.get('x-api-key'), provider === 'anthropic' && key ? expected : null);
    assert.equal(actual.get('x-goog-api-key'), provider === 'google' ? expected : null);
    assert.equal(actual.get('api-key'), null);
    for (const name of ['x-review-proxy-credential', 'cookie', 'openai-organization', 'openai-project']) {
        assert.equal(actual.get(name), null, name);
    }
}

test('direct Agent requests preserve explicit auth through real SDK requests and tool continuations', async t => {
    // Fake ambient credentials must never override an explicit preset or an empty key.
    const env = Object.fromEntries(['OPENAI_API_KEY', 'OPENAI_ADMIN_KEY', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID',
        'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']
        .map(key => [key, 'ambient-not-for-this-agent']));
    env.OPENAI_CUSTOM_HEADERS = [
        'X-Api-Key: review-fake-ambient-key',
        'X-Review-Proxy-Credential: review-fake-custom-secret',
        'Cookie: review-fake-cookie',
        'Authorization: Bearer review-fake-ambient-token',
        'api-key: review-fake-azure-key',
        'Accept: review-fake-ambient-accept',
        'Content-Type: application/x-www-form-urlencoded',
    ].join('\n');
    const previous = new Map(Object.keys(env).map(key => [key, process.env[key]]));
    Object.assign(process.env, env);
    t.after(() => { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
    for (const [runtime, factory] of [['node', createAgentAdapter], ['browser', browserCore.createAgentAdapter]]) {
        for (const provider of providers) {
            for (const apiKey of ['', '   ', undefined, ' test-key ']) {
                for (const streaming of [false, true]) {
                    await t.test(`${runtime}/${provider}, key=${JSON.stringify(apiKey)}, stream=${streaming}`, async t => {
                        const service = await mockProvider(t, provider, { streaming });
                        const config = { provider, apiKey, baseUrl: service.baseUrl, model: 'test-model', timeoutMs: 3000, toolMode: 'native' };
                        const adapter = factory(config);
                        const task = { messages, tools, maxTokens: 32, ...(streaming ? { onStreamProgress() {} } : {}) };
                        const first = await adapter.chat(task);
                        assert.equal(first.toolCalls.length, 1);
                        assert.equal(first.toolCalls[0].name, 'ping');
                        const call = first.toolCalls[0];
                        const second = await adapter.chat({ ...task, messages: [...messages,
                            buildProviderAssistantToolCallMessage(first, first.toolCalls),
                            buildProviderToolResultMessage({ toolCallId: call.id, toolName: call.name, content: '{"ok":true}' }),
                        ], ...(provider === 'google' ? { toolResponses: [{ ...call, response: { ok: true } }] } : {}) });
                        assert.equal(second.text, 'OK');
                        assert.equal(service.requests.length, 2);
                        const key = apiKey?.trim() || '';
                        for (const request of service.requests) {
                            assertAuth(request.headers, provider, key);
                            if (provider.startsWith('openai-')) {
                                assert.equal(request.headers['content-type'], 'application/json');
                                assert.equal(request.headers.accept, 'application/json');
                                assert.equal(request.body.model, 'test-model');
                            }
                        }
                        for (const result of [first, second]) assertAuth(result.requestInspection.request.headers, provider, key, true);
                        assert.equal(config.apiKey, apiKey);
                        for (const [name, value] of Object.entries(env)) assert.equal(process.env[name], value);
                    });
                }
            }
        }
    }
});

test('model listing allows no key and never retries authentication failures as another identity', async t => {
    for (const provider of providers) {
        for (const apiKey of ['', ' test-key ']) {
            await t.test(`${provider}, key=${JSON.stringify(apiKey)}`, async t => {
                const service = await mockProvider(t, provider);
                assert.deepEqual(await pullModelsForProvider({ provider, apiKey, baseUrl: service.baseUrl }), ['test-model']);
                assert.equal(service.requests.length, 1);
                assertAuth(service.requests[0].headers, provider, apiKey.trim());
                const query = new URL(service.requests[0].url, service.baseUrl).searchParams;
                assert.equal(query.get('key'), provider === 'google' && apiKey ? apiKey.trim() : null);
            });
        }
        for (const status of [401, 403]) {
            await t.test(`${provider} propagates ${status}`, async t => {
                const service = await mockProvider(t, provider, { status });
                const config = { provider, apiKey: '', baseUrl: service.baseUrl, model: 'test-model', timeoutMs: 3000 };
                await assert.rejects(pullModelsForProvider(config));
                assert.equal(service.requests.length, 1);
                await assert.rejects(createAgentAdapter(config).chat({ messages, maxTokens: 16 }), error => error.status === status);
                assert.equal(service.requests.length, 2);
            });
        }
    }
});
