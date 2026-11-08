import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { normalizeAgentSettings } from '../config.js';
import { createPublicAgentApi } from '../public-api.js';
import { TOOL_RESULT_PAGE_CHARS } from '../runtime/tool-result-pages.js';
import { WEB_RESPONSE_BYTES } from '../web/http.js';

// Offline semantic boundaries: configuration isolation, caller-owned tool rounds,
// provider replay, cancellation/concurrency, credentials and existing web routing.
function settings(overrides = {}) {
    return normalizeAgentSettings({
        currentPresetName: 'main',
        presets: { main: { provider: 'openai-compatible', model: 'fixture-main', apiKey: '', temperature: 0.37, maxTokens: 4321,
            toolMode: 'native', reasoning: { mode: 'off', output: 'hide' } } },
        delegateConfigured: true,
        delegateConfig: { provider: 'google', model: 'gemini-2.5-pro', apiKey: 'delegate-secret-fixture' },
        tavilyApiKey: 'tavily-secret-fixture', exaApiKey: 'exa-secret-fixture',
        ...overrides,
    });
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
    return { promise, resolve, reject };
}

function harness(options = {}) {
    let enabled = true;
    let saved = options.settings ?? settings();
    let settingsReads = 0;
    let coreLoads = 0;
    const configs = [];
    const tasks = [];
    const host = createPublicAgentApi({
        isEnabled: () => enabled,
        loadSettings: () => { settingsReads++; return options.loadSettings ? options.loadSettings() : saved; },
        loadCore: async () => {
            coreLoads++;
            if (options.loadCore) return options.loadCore();
            return { createAgentAdapter(config) {
                configs.push(config);
                return { chat: async task => {
                    tasks.push(task);
                    return options.chat ? options.chat(task, config) : { text: 'done', toolCalls: [] };
                } };
            } };
        },
    });
    return { ...host, configs, tasks,
        setEnabled(value) { enabled = value; },
        setSettings(value) { saved = value; },
        settingsReads: () => settingsReads, coreLoads: () => coreLoads,
    };
}

const input = () => ({ systemPrompt: 'Offline fixture', messages: [{ role: 'user', content: 'fixture request' }] });
const call = { id: 'internal-1', name: 'lookup', arguments: '{"subject":"fixture"}', providerId: '' };
const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } }];
const rejectsCode = (promise, code) => assert.rejects(promise, error => {
    assert.equal(error.code, code);
    if (code === 'AGENT_ABORTED') assert.equal(error.name, 'AbortError');
    assert.deepEqual(Object.keys(error).sort(), ['code']);
    return true;
});

async function withFetch(t, handler) {
    const previous = globalThis.fetch;
    globalThis.fetch = handler;
    t.after(() => { globalThis.fetch = previous; });
}

function json(value, status = 200) {
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

test('sessions snapshot shared settings once, resolve explicit roles and lazily reuse adapters/core', async () => {
    const saved = settings();
    const h = harness({ settings: saved });
    const session = await h.api.openSession();
    assert.equal(h.settingsReads(), 1);
    assert.equal(h.coreLoads(), 0);
    saved.presets.main.model = 'changed-after-open';
    saved.presets.main.reasoning.output = 'show';
    await session.chat(input());
    await session.chat(input());
    assert.equal(h.settingsReads(), 1);
    assert.equal(h.configs.length, 1);
    assert.equal(h.coreLoads(), 1);
    assert.equal(h.configs[0].model, 'fixture-main');
    assert.equal(h.configs[0].apiKey, '');
    assert.equal(h.tasks[0].temperature, 0.37);
    assert.equal(h.tasks[0].maxTokens, 4321);
    assert.deepEqual(h.tasks[0].reasoning, h.configs[0].reasoning);
    assert.equal(h.tasks[0].reasoning.output, 'hide');
    const delegate = await h.api.openSession({ api: 'delegate' });
    await delegate.chat(input());
    assert.equal(h.configs[1].provider, 'google');
    assert.equal(h.configs[1].model, 'gemini-2.5-pro');
    assert.equal(h.coreLoads(), 1);
    session.dispose(); delegate.dispose();
});

test('delegateConfigured must be exactly true; explicit delegate never silently inherits main', async () => {
    for (const flag of [false, undefined, 'true', 1]) {
        const saved = settings();
        saved.delegateConfigured = flag;
        const h = harness({ settings: saved });
        await rejectsCode(h.api.openSession({ api: 'delegate' }), 'AGENT_DELEGATE_NOT_CONFIGURED');
        assert.equal(h.coreLoads(), 0);
        const main = await h.api.openSession({ api: 'main' });
        main.dispose();
    }
});

test('inherited sendTemperature false suppresses temperature and caller model settings are rejected', async () => {
    const saved = settings();
    saved.presets.main.sendTemperature = false;
    const h = harness({ settings: saved });
    const session = await h.api.openSession();
    await session.chat(input());
    assert.equal(h.tasks[0].temperature, undefined);
    assert.equal(h.configs[0].sendTemperature, false);
    for (const key of ['model', 'apiKey', 'temperature', 'maxTokens', 'reasoning', 'toolResponses', 'allowToolProtocolFallback']) {
        await rejectsCode(session.chat({ ...input(), [key]: 'override' }), 'AGENT_INVALID_INPUT');
    }
    await rejectsCode(h.api.openSession({ api: 'main', model: 'override' }), 'AGENT_INVALID_INPUT');
    await session.chat(input());
    assert.equal(h.tasks.length, 2);
    session.dispose();
});

test('one adapter chat per round; canonical replies/results replay with no hidden tool loop or history', async () => {
    const payload = { googleContent: { role: 'model', parts: [{ thought: true, text: 'signed', thoughtSignature: 'signature' },
        { functionCall: { name: 'lookup', args: { subject: 'fixture' } } }] } };
    const h = harness({ chat: (_task, _config) => ({
        text: 'tool requested', provider: 'google', providerPayload: payload,
        thoughts: [{ label: 'thinking', text: 'draft' }],
        usage: { input: 3, output: 4 }, finishReason: 'MAX_TOKENS', completion: 'incomplete', truncated: true,
        requestInspection: { secret: 'private request' }, internal: 'not public',
    }) });
    const session = await h.api.openSession();
    const result = await session.chat({ ...input(), tools, toolChoice: 'required' });
    assert.equal(h.tasks.length, 1);
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].providerId, '');
    assert.equal(result.reply.tool_calls[0].providerToolCallId, '');
    assert.deepEqual(result.reply.providerPayload, payload);
    assert.deepEqual(Object.keys(result).sort(), ['completion', 'finishReason', 'model', 'provider', 'reply', 'text', 'thoughts', 'toolCalls', 'truncated', 'usage']);
    const replay = JSON.parse(JSON.stringify(result.reply));
    const toolResult = session.toolResult(result.toolCalls[0], { found: true });
    const history = [...input().messages, replay, toolResult];
    await session.chat({ messages: history, tools, toolChoice: 'none' });
    assert.equal(h.tasks.length, 2);
    assert.deepEqual(h.tasks[1].messages, history);
    assert.equal(Object.hasOwn(h.tasks[1], 'toolResponses'), false);
    assert.equal(Object.hasOwn(h.tasks[1], 'finalAnswerReminderText'), false);
    assert.notEqual(h.tasks[1].messages, history);
    session.dispose();
});

test('native replay survives JSON copy even for assistant turns without tool calls', async () => {
    for (const providerPayload of [
        { anthropicContent: [{ type: 'thinking', thinking: 'private', signature: 'signed' }, { type: 'text', text: 'answer' }] },
        { googleContent: { role: 'model', parts: [{ text: 'answer', thoughtSignature: 'signed' }] } },
        { openaiMessage: { role: 'assistant', content: 'answer', reasoning_content: 'reasoning' } },
        { responsesOutput: [{ type: 'reasoning', id: 'rs-1', encrypted_content: 'signed' }] },
    ]) {
        const h = harness({ chat: () => ({ text: 'answer', toolCalls: [], providerPayload }) });
        const session = await h.api.openSession();
        const result = await session.chat(input());
        assert.deepEqual(result.reply.providerPayload, providerPayload);
        assert.deepEqual(result.reply.tool_calls, []);
        const replay = JSON.parse(JSON.stringify(result.reply));
        await session.chat({ messages: [...input().messages, replay, { role: 'user', content: 'next' }] });
        assert.deepEqual(h.tasks[1].messages[1], replay);
        session.dispose();
    }
});

test('same-origin iframe JSON objects and replay messages cross realms without hidden handles', async () => {
    const h = harness({ chat: () => ({ text: 'answer', toolCalls: [call], providerPayload: { googleContent: { role: 'model', parts: [{ text: 'answer', thoughtSignature: 'signed' }] } } }) });
    const session = await h.api.openSession(runInNewContext('({api: "main"})'));
    const result = await session.chat(runInNewContext('({messages: [{role: "user", content: "fixture"}]})'));
    const replay = runInNewContext('JSON.parse(serialized)', { serialized: JSON.stringify(result.reply) });
    const toolResult = session.toolResult(runInNewContext('({id: "internal-1", name: "lookup", arguments: "{}"})'),
        runInNewContext('({items: [1, null], nested: {ok: true}})'));
    await session.chat({ messages: [replay, toolResult] });
    assert.deepEqual(h.tasks[1].messages[0], result.reply);
    assert.deepEqual(JSON.parse(h.tasks[1].messages[1].content), { items: [1, null], nested: { ok: true } });
    session.dispose();
});

test('SDK optional undefined fields do not discard paid replies or signed replay payloads', async () => {
    const h = harness({ chat: () => ({ text: 'answer', toolCalls: [], usage: { input: 3, optional: undefined },
        providerPayload: { googleContent: { role: 'model', parts: [{ text: 'answer', thoughtSignature: 'signed', optional: undefined }] }, optional: undefined } }) });
    const session = await h.api.openSession();
    const result = await session.chat(input());
    assert.deepEqual(result.usage, { input: 3 });
    assert.deepEqual(result.reply.providerPayload, { googleContent: { role: 'model', parts: [{ text: 'answer', thoughtSignature: 'signed' }] } });
    assert.deepEqual(JSON.parse(JSON.stringify(result.reply)), result.reply);
    session.dispose();
});

test('incomplete tool calls are normalized through existing protocol and do not trigger retries', async () => {
    const h = harness({ chat: () => ({ completion: 'incomplete', toolCalls: [{ ...call, arguments: '{"cut":' }] }) });
    const session = await h.api.openSession();
    await rejectsCode(session.chat(input()), 'AGENT_TOOL_ARGUMENTS_INVALID');
    assert.equal(h.tasks.length, 1);
    session.dispose();
});

test('toolResult preserves ID/name and JSON objects; wraps other JSON values without losing data', async () => {
    const session = await harness().api.openSession();
    for (const value of [{ items: [1, null], result: 'already an object' }, Object.create(null), [1, 'text'], 'text', 0, false, null]) {
        const result = session.toolResult(call, value);
        assert.equal(result.role, 'tool');
        assert.equal(result.tool_call_id, call.id);
        assert.equal(result.toolName, call.name);
        assert.deepEqual(JSON.parse(result.content), Array.isArray(value) || value === null || typeof value !== 'object'
            ? { result: value } : JSON.parse(JSON.stringify(value)));
    }
    const cyclic = {}; cyclic.self = cyclic;
    const sparse = []; sparse.length = 1;
    const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { throw new Error('must not execute getter'); } });
    const nonEnumerable = Object.defineProperty({}, 'hidden', { value: 1 });
    for (const value of [undefined, NaN, Infinity, -Infinity, -0, 1n, () => {}, Symbol('x'), new Date(), new Map(), cyclic,
        { bad: undefined }, { bad: () => {} }, [undefined], sparse, accessor, nonEnumerable, { [Symbol('x')]: 1 }]) {
        assert.throws(() => session.toolResult(call, value), { code: 'AGENT_INVALID_INPUT' });
    }
    session.dispose();
});

test('chat rejects non-object tool content before any adapter dispatch and validates public inputs', async () => {
    const h = harness();
    const session = await h.api.openSession();
    for (const content of ['null', '[]', '1', '"text"', 'false', '{broken']) {
        await rejectsCode(session.chat({ messages: [{ role: 'tool', tool_call_id: 'one', content }] }), 'AGENT_INVALID_INPUT');
    }
    for (const value of [{}, { messages: {} }, { messages: [{ role: 'unknown', content: 'x' }] },
        { ...input(), tools: [{}] }, { ...input(), toolChoice: 'lookup' }, { ...input(), toolChoice: 'required' },
        { ...input(), signal: {} }, { ...input(), onStreamProgress: true }]) {
        await rejectsCode(session.chat(value), 'AGENT_INVALID_INPUT');
    }
    assert.equal(h.coreLoads(), 0);
    await session.chat({ messages: [session.toolResult(call, { data: 1 })] });
    assert.equal(h.tasks.length, 1);
    session.dispose();
});

test('stream exposes drafts only, final normalized calls are separate, and callback failures release busy', async () => {
    const snapshots = [];
    let callback;
    const h = harness({ chat: task => {
        callback = task.onStreamProgress;
        task.onStreamProgress?.({ activity: 'thinking', text: 'draft', toolCalls: [call], requestInspection: { private: true }, providerPayload: { private: true } });
        return { text: 'final', toolCalls: [call] };
    } });
    const session = await h.api.openSession();
    const result = await session.chat({ ...input(), onStreamProgress: draft => snapshots.push(draft) });
    assert.equal(snapshots[0].toolCallDraft, true);
    assert.equal(snapshots[0].activity, 'thinking');
    callback({ text: 'late draft', activity: { private: true } });
    assert.equal(snapshots.length, 1);
    assert.equal(Object.hasOwn(snapshots[0], 'requestInspection'), false);
    assert.equal(Object.hasOwn(snapshots[0], 'providerPayload'), false);
    snapshots[0].toolCalls[0].name = 'mutated';
    assert.equal(result.toolCalls[0].name, 'lookup');
    await assert.rejects(session.chat({ ...input(), onStreamProgress() { throw new Error('caller callback failed'); } }));
    await session.chat(input());
    assert.equal(h.tasks.length, 3);
    session.dispose();
});

test('same-session requests are busy while independent sessions dispatch concurrently', async () => {
    const gate = deferred();
    const started = deferred();
    const h = harness({ chat: () => { if (h.tasks.length === 2) started.resolve(); return gate.promise; } });
    const one = await h.api.openSession();
    const two = await h.api.openSession();
    const first = one.chat(input());
    await rejectsCode(one.chat(input()), 'AGENT_SESSION_BUSY');
    const second = two.chat(input());
    await started.promise;
    assert.equal(h.tasks.length, 2);
    gate.resolve({ text: 'done' });
    await Promise.all([first, second]);
    await one.chat(input());
    one.dispose(); two.dispose();
});

test('pre-abort, configuration/core awaits, dispatch and late adapter results obey cancellation', async () => {
    const pre = new AbortController(); pre.abort();
    const h = harness();
    await rejectsCode(h.api.openSession({ signal: pre.signal }), 'AGENT_ABORTED');
    assert.equal(h.settingsReads(), 0);
    const settingsGate = deferred();
    const opening = harness({ loadSettings: () => settingsGate.promise });
    const signal = new AbortController();
    const pendingOpen = opening.api.openSession({ signal: signal.signal });
    signal.abort();
    await rejectsCode(pendingOpen, 'AGENT_ABORTED');
    settingsGate.resolve(settings());
    assert.equal(opening.coreLoads(), 0);

    const coreGate = deferred();
    const loading = harness({ loadCore: () => coreGate.promise });
    const loadingSession = await loading.api.openSession();
    const chatSignal = new AbortController();
    const pendingChat = loadingSession.chat({ ...input(), signal: chatSignal.signal });
    chatSignal.abort();
    await rejectsCode(pendingChat, 'AGENT_ABORTED');
    let dispatches = 0;
    coreGate.resolve({ createAgentAdapter: () => ({ chat: async () => { dispatches++; return { text: 'done' }; } }) });
    await loadingSession.chat(input());
    assert.equal(dispatches, 1);
    loadingSession.dispose();

    const adapterGate = deferred();
    const started = deferred();
    const running = harness({ chat: () => { started.resolve(); return adapterGate.promise; } });
    const session = await running.api.openSession();
    const abort = new AbortController();
    const request = session.chat({ ...input(), signal: abort.signal });
    await started.promise;
    abort.abort();
    await rejectsCode(request, 'AGENT_ABORTED');
    assert.equal(running.tasks[0].signal.aborted, true);
    adapterGate.resolve({ text: 'late result must not escape' });
    await session.chat(input());
    session.dispose();
});

test('dispose and host disable invalidate pending work and old sessions; stable facade re-enables', async () => {
    const gate = deferred();
    const started = deferred();
    const h = harness({ chat: () => { started.resolve(); return gate.promise; } });
    const stable = h.api;
    const session = await h.api.openSession();
    const request = session.chat(input());
    await started.promise;
    h.setEnabled(false);
    h.cancelAll();
    await rejectsCode(request, 'AGENT_DISABLED');
    await rejectsCode(session.chat(input()), 'AGENT_DISABLED');
    await rejectsCode(h.api.openSession(), 'AGENT_DISABLED');
    h.setEnabled(true);
    assert.equal(h.api, stable);
    await rejectsCode(session.chat(input()), 'AGENT_DISABLED');
    const fresh = await stable.openSession();
    gate.resolve({ text: 'fresh result' });
    assert.equal((await fresh.chat(input())).text, 'fresh result');
    fresh.dispose(); fresh.dispose();
    await rejectsCode(fresh.chat(input()), 'AGENT_SESSION_DISPOSED');
    assert.throws(() => fresh.toolResult(call, {}), { code: 'AGENT_SESSION_DISPOSED' });
});

test('enabled checks after awaits prevent dispatch and return even if host omitted cancelAll', async () => {
    const gate = deferred();
    const h = harness({ loadSettings: () => gate.promise });
    const opening = h.api.openSession();
    h.setEnabled(false);
    gate.resolve(settings());
    await rejectsCode(opening, 'AGENT_DISABLED');
    assert.equal(h.coreLoads(), 0);
    const ended = harness({ chat: () => { ended.setEnabled(false); return { text: 'must not escape' }; } });
    const session = await ended.api.openSession();
    await rejectsCode(session.chat(input()), 'AGENT_DISABLED');
    session.dispose();
});

test('session lifetime signals close sessions and request signal listeners are removed', async () => {
    const lifetime = new AbortController();
    const h = harness();
    const session = await h.api.openSession({ signal: lifetime.signal });
    const request = new AbortController();
    let added = 0; let removed = 0;
    const add = request.signal.addEventListener.bind(request.signal);
    const remove = request.signal.removeEventListener.bind(request.signal);
    request.signal.addEventListener = (...args) => { added++; return add(...args); };
    request.signal.removeEventListener = (...args) => { removed++; return remove(...args); };
    await session.chat({ ...input(), signal: request.signal });
    assert.equal(added, removed);
    lifetime.abort();
    await rejectsCode(session.chat(input()), 'AGENT_ABORTED');
});

test('public errors retain useful diagnostics/status but only expose code/message/status and scrub every configured key', async () => {
    const saved = settings();
    saved.presets.main.apiKey = 'selected-secret-fixture';
    const raw = Object.assign(new Error('Quota exceeded for selected-secret-fixture, delegate-secret-fixture, tavily-secret-fixture and exa-secret-fixture; request fixture-123'), {
        code: 'provider_quota', status: 429, cause: { config: saved }, config: saved, requestInspection: { config: saved },
    });
    const h = harness({ settings: saved, chat: () => { throw raw; } });
    const session = await h.api.openSession();
    await assert.rejects(session.chat(input()), error => {
        assert.equal(error.code, 'provider_quota');
        assert.equal(error.status, 429);
        assert.deepEqual(Object.keys(error).sort(), ['code', 'status']);
        assert.match(error.message, /Quota exceeded/);
        assert.match(error.message, /fixture-123/);
        for (const secret of ['selected-secret-fixture', 'delegate-secret-fixture', 'tavily-secret-fixture', 'exa-secret-fixture']) assert.equal(error.message.includes(secret), false);
        assert.equal(Object.hasOwn(error, 'cause'), false);
        assert.equal(Object.hasOwn(error, 'config'), false);
        assert.equal(Object.hasOwn(error, 'requestInspection'), false);
        return true;
    });
    session.dispose();
});

test('status is a sanitized settings-only projection without provider probes or adapter loading', async () => {
    const h = harness();
    const status = await h.api.getStatus();
    assert.deepEqual(status, {
        enabled: true,
        main: { configured: true, provider: 'openai-compatible', model: 'fixture-main' },
        delegate: { configured: true, provider: 'google', model: 'gemini-2.5-pro' },
        web: { configured: true, provider: 'tavily' },
    });
    assert.equal(h.coreLoads(), 0);
    h.setEnabled(false);
    assert.equal((await h.api.getStatus()).enabled, false);
});

test('web definitions are independent clones; search/fetch use current global settings, throw errors and retain partial pages', async t => {
    const requests = [];
    await withFetch(t, async (url, request) => {
        requests.push({ url, body: JSON.parse(request.body), headers: request.headers });
        if (url.endsWith('/search')) return json({ results: [{ title: 'fixture', url: 'https://example.com/', content: 'excerpt', score: 1 }] });
        return json({ results: [{ url: 'https://example.com/', raw_content: 'page body' }],
            failed_results: [{ url: 'https://example.org/', error: 'not available' }], request_id: 'fixture-request' });
    });
    const h = harness();
    const definitions = h.api.web.getTools();
    assert.equal(definitions.length, 2);
    definitions[0].function.parameters.properties.query.type = 'changed';
    assert.equal(h.api.web.getTools()[0].function.parameters.properties.query.type, 'string');
    assert.equal(h.settingsReads(), 0);
    const search = await h.api.web.search({ query: ' fixture ', maxResults: 2 });
    assert.equal(search.ok, true);
    assert.equal(search.query, 'fixture');
    assert.equal(search.count, 1);
    assert.equal(requests[0].body.api_key, 'tavily-secret-fixture');
    h.setSettings(settings({ tavilyApiKey: 'new-global-fixture', tavilyBaseUrl: 'https://relay.example.net/' }));
    const fetched = await h.api.web.fetch({ urls: ['https://example.com/', 'https://example.org/'] });
    assert.equal(fetched.ok, false);
    assert.equal(fetched.results[0].text, 'page body');
    assert.deepEqual(fetched.failedUrls, ['https://example.org/']);
    assert.equal(fetched.requestId, 'fixture-request');
    assert.equal(requests[1].url, 'https://relay.example.net/extract');
    assert.equal(requests[1].headers.Authorization, 'Bearer new-global-fixture');
    assert.equal(h.settingsReads(), 2);
    assert.equal(h.coreLoads(), 0);
    globalThis.fetch = async () => json({ detail: 'new-global-fixture exa-secret-fixture outage fixture-123' }, 503);
    await assert.rejects(h.api.web.search({ query: 'fixture' }), error => {
        assert.equal(error.status, 503);
        assert.equal(error.message.includes('new-global-fixture'), false);
        assert.equal(error.message.includes('exa-secret-fixture'), false);
        assert.equal(Object.hasOwn(error, 'raw'), false);
        return true;
    });
});

test('web abort and host disable reject pending fetches and never return late data', async t => {
    const gate = deferred();
    const started = deferred();
    let requestSignal;
    await withFetch(t, async (_url, request) => { requestSignal = request.signal; started.resolve(); return gate.promise; });
    const h = harness();
    const search = h.api.web.search({ query: 'fixture' });
    await started.promise;
    h.setEnabled(false); h.cancelAll();
    await rejectsCode(search, 'AGENT_DISABLED');
    assert.equal(requestSignal.aborted, true);
    gate.resolve(json({ results: [] }));
    h.setEnabled(true);
    const aborted = new AbortController(); aborted.abort();
    await rejectsCode(h.api.web.search({ query: 'fixture', signal: aborted.signal }), 'AGENT_ABORTED');
});

for (const provider of ['tavily', 'exa']) test(`session ${provider} pages retain complete web text without another HTTP request`, async t => {
    const text = 'x'.repeat(TOOL_RESULT_PAGE_CHARS * 3) + '😀FINAL_PAGE';
    let requests = 0;
    await withFetch(t, async () => {
        requests++;
        return json(provider === 'tavily'
            ? { results: [{ url: 'https://example.com/', raw_content: text }] }
            : { results: [{ url: 'https://example.com/', text }], statuses: [{ id: 'https://example.com/', status: 'success' }] });
    });
    const h = harness({ settings: settings({ webProvider: provider }) });
    const session = await h.api.openSession();
    t.after(() => session.dispose());
    const definitions = session.web.getTools();
    assert.deepEqual(definitions.map(tool => tool.function.name), ['web_search', 'web_fetch', 'ToolResultRead']);
    definitions[0].function.parameters.properties.query.type = 'changed';
    assert.equal(session.web.getTools()[0].function.parameters.properties.query.type, 'string');
    const first = await session.web.fetch({ urls: ['https://example.com/'] });
    assert.equal(first.status, 'read'); assert.equal(first.ok, true);
    const { reference, totalChars } = first.data;
    assert.deepEqual(session.web.read({ reference }).data, first.data);
    let combined = first.data.text, next = first.data.nextOffset;
    while (next !== null) {
        const page = session.web.read({ reference, offset: next }).data;
        assert.equal(page.offset, next); assert.ok(page.text.length <= TOOL_RESULT_PAGE_CHARS);
        assert.equal(page.reference, reference); assert.equal(page.totalChars, totalChars);
        combined += page.text; next = page.nextOffset;
    }
    assert.equal(combined.length, totalChars);
    assert.equal(JSON.parse(combined).results[0].text, text);
    const middle = session.web.read({ reference, offset: 17 }).data;
    assert.equal(middle.text, combined.slice(17, 17 + TOOL_RESULT_PAGE_CHARS));
    assert.deepEqual(session.web.read({ reference, offset: totalChars }).data,
        { reference, offset: totalChars, nextOffset: null, totalChars, text: '' });
    assert.equal(requests, 1); assert.equal(h.coreLoads(), 0);
    const replay = session.toolResult({ id: 'page-read', name: 'ToolResultRead', arguments: '{}' }, first);
    assert.deepEqual(JSON.parse(replay.content), first);
});

test('session search pages and small raw results use current shared web settings', async t => {
    const requests = [], text = 'SEARCH'.repeat(TOOL_RESULT_PAGE_CHARS);
    await withFetch(t, async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return json({ results: [{ title: 'source', url: 'https://example.com/', content: requests.length === 1 ? 'small' : text }] });
    });
    const h = harness(), session = await h.api.openSession();
    t.after(() => session.dispose());
    const small = await session.web.search({ query: 'small' });
    assert.equal(small.results[0].content, 'small'); assert.equal(Object.hasOwn(small, 'data'), false);
    h.setSettings(settings({ tavilyApiKey: 'changed-key', tavilyBaseUrl: 'https://new.example.com' }));
    const large = await session.web.search({ query: 'large' });
    assert.equal(large.status, 'read'); assert.ok(large.data.nextOffset > 0);
    assert.equal(requests[1].body.api_key, 'changed-key'); assert.equal(requests[1].url, 'https://new.example.com/search');
    assert.equal(h.settingsReads(), 3); assert.equal(h.coreLoads(), 0);
});

test('paged partial extraction retains all failure diagnostics and redacts provider secrets', async t => {
    const text = 'PAGE'.repeat(TOOL_RESULT_PAGE_CHARS);
    await withFetch(t, async () => json({ results: [{ url: 'https://example.com/', raw_content: text }],
        failed_results: [{ url: 'https://example.org/', error: 'tavily-secret-fixture DIAGNOSTIC_' + 'z'.repeat(400) }], request_id: 'request-fixture' }));
    const h = harness(), session = await h.api.openSession();
    t.after(() => session.dispose());
    const first = await session.web.fetch({ urls: ['https://example.com/', 'https://example.org/'] });
    assert.equal(first.ok, false); assert.equal(first.status, 'partial');
    let textResult = first.data.text, offset = first.data.nextOffset;
    while (offset !== null) {
        const page = session.web.read({ reference: first.data.reference, offset }).data;
        textResult += page.text; offset = page.nextOffset;
    }
    const result = JSON.parse(textResult);
    assert.equal(result.results[0].text, text); assert.equal(result.requestId, 'request-fixture');
    assert.deepEqual(result.failedUrls, ['https://example.org/']);
    assert.equal(result.failures[0].code, 'web_source_unavailable');
    assert.ok(result.failures[0].message.endsWith('z'.repeat(400)));
    assert.equal(textResult.includes('tavily-secret-fixture'), false);
});

test('session references isolate owners; eviction and invalid ranges have stable error codes', async t => {
    const text = 'x'.repeat(Math.floor(WEB_RESPONSE_BYTES * 0.6));
    await withFetch(t, async () => json({ results: [{ url: 'https://example.com/', raw_content: text }] }));
    const h = harness(), first = await h.api.openSession(), second = await h.api.openSession();
    const otherFacade = harness(), third = await otherFacade.api.openSession();
    t.after(() => { first.dispose(); second.dispose(); third.dispose(); });
    const a = await first.web.fetch({ urls: ['https://example.com/'] });
    const b = await second.web.fetch({ urls: ['https://example.com/'] });
    const c = await third.web.fetch({ urls: ['https://example.com/'] });
    assert.equal(new Set([a.data.reference, b.data.reference, c.data.reference]).size, 3);
    for (const owner of [second, third]) assert.throws(() => owner.web.read({ reference: a.data.reference }), { code: 'tool_result_expired' });
    for (const offset of [-1, a.data.totalChars + 1]) assert.throws(() => first.web.read({ reference: a.data.reference, offset }), { code: 'tool_result_range_invalid' });
    for (const input of [{ reference: '' }, { reference: a.data.reference, offset: '1' }, { reference: a.data.reference, offset: 1.5 }, { reference: a.data.reference, unknown: true }]) {
        assert.throws(() => first.web.read(input), { code: 'AGENT_INVALID_INPUT' });
    }
    await first.web.fetch({ urls: ['https://example.com/'] });
    assert.throws(() => first.web.read({ reference: a.data.reference }), { code: 'tool_result_expired' });
    assert.deepEqual(second.web.read({ reference: b.data.reference }).data, b.data);
});

for (const ending of ['dispose', 'abort', 'disable']) test(`session web ${ending} rejects pending and late results, and closes retained pages`, async t => {
    const entered = deferred(), release = deferred(); let signal, requests = 0;
    await withFetch(t, async (_url, init) => {
        requests++;
        if (requests === 1) return json({ results: [{ url: 'https://example.com/', raw_content: 'x'.repeat(TOOL_RESULT_PAGE_CHARS * 2) }] });
        signal = init.signal; entered.resolve(); return release.promise;
    });
    const controller = new AbortController(), h = harness();
    const session = await h.api.openSession({ signal: controller.signal });
    const first = await session.web.fetch({ urls: ['https://example.com/'] });
    const pending = session.web.fetch({ urls: ['https://example.org/'] });
    await entered.promise;
    const code = ending === 'dispose' ? 'AGENT_SESSION_DISPOSED' : ending === 'abort' ? 'AGENT_ABORTED' : 'AGENT_DISABLED';
    if (ending === 'dispose') session.dispose();
    else if (ending === 'abort') controller.abort();
    else { h.setEnabled(false); h.cancelAll(); }
    await rejectsCode(pending, code); assert.equal(signal.aborted, true);
    assert.throws(() => session.web.getTools(), { code });
    assert.throws(() => session.web.read({ reference: first.data.reference }), { code });
    await rejectsCode(session.web.search({ query: 'after-close' }), code);
    release.resolve(json({ results: [{ url: 'https://example.org/', raw_content: 'late data' }] }));
    h.setEnabled(true);
    assert.throws(() => session.web.read({ reference: first.data.reference }), { code });
    assert.equal(requests, 2);
});

test('official Exa still uses the existing browser backend routing', async t => {
    const oldWindow = globalThis.window;
    const oldHost = globalThis.SillyTavern;
    globalThis.window = {};
    globalThis.SillyTavern = { getContext: () => ({ getRequestHeaders: () => ({ 'X-CSRF-Token': 'fixture-csrf' }) }) };
    t.after(() => { globalThis.window = oldWindow; globalThis.SillyTavern = oldHost; });
    let received;
    await withFetch(t, async (url, request) => {
        received = { url, request, body: JSON.parse(request.body) };
        return json({ results: [{ title: 'fixture', url: 'https://example.com/', highlights: ['excerpt'] }] });
    });
    const h = harness({ settings: settings({ webProvider: 'exa' }) });
    const result = await h.api.web.search({ query: 'fixture' });
    assert.equal(result.ok, true);
    assert.match(received.url, /^\/api\/plugins\/.*\/web\/exa\/search$/);
    assert.equal(received.request.credentials, 'same-origin');
    assert.equal(received.body.apiKey, 'exa-secret-fixture');
    assert.equal(received.body.payload.query, 'fixture');
});
