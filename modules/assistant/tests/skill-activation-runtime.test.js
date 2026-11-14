import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantRuntime } from '../app-src/runtime.js';
import { TOOL_DEFINITIONS, TOOL_NAMES, formatToolResultDisplay } from '../app-src/tooling.js';

// Contracts: only confirmed skill receipts unlock tools; request snapshots reject premature calls.
// Compacted activation belongs to the parent conversation; delegates learn only from their own receipts.
// Session providers retain initial tools, so changed availability requires a complete replay.
const done = { text: 'Verified.', toolCalls: [] };
let callId = 0;
const call = (name, args = {}) => ({ id: `skill-call-${++callId}`, name, arguments: JSON.stringify(args) });
const step = (...toolCalls) => ({ text: '', toolCalls });
const readSkill = id => call(TOOL_NAMES.READ_SKILL, { id });
const names = task => new Set(task.tools.map(definition => definition.function.name));

function harness(t, { steps, delegates = [], archivedSkillIds = [], results = {}, session = false, user = 'Inspect the fixture.', skills = [] }) {
    t.mock.method(console, 'info', () => {});
    const run = { id: 'skill-runtime', controller: new AbortController(), toolRequestIds: new Set(), workspaceBaseline: [] };
    const state = { messages: [{ role: 'user', content: user }], archivedTurnCount: 0, archivedSkillIds,
        activeRun: run, runtime: { skillsCatalog: { skills } } };
    const pendingToolCalls = new Map(), requests = [], dispatched = [];
    let requestId = 0, delegateIndex = 0;
    const runtime = createAssistantRuntime({
        state, TOOL_NAMES, TOOL_DEFINITIONS, pendingToolCalls, pendingApprovals: new Map(),
        render() {}, persistSession() {}, showToast() {}, createRequestId: () => `skill-request-${++requestId}`,
        safeJsonParse: JSON.parse, describeError: error => error.message, formatToolResultDisplay,
        normalizeAttachments: () => [], normalizeThoughtBlocks: () => [], buildUserContentParts: message => message.content,
        normalizeSlashSkillTrigger: value => value.startsWith('/') ? value.trim() : '',
        getActiveProviderConfig: () => ({ provider: 'openai-compatible' }),
        getDelegateProviderConfig: () => ({ provider: 'openai-compatible' }),
        getToolDefinitions: () => TOOL_DEFINITIONS,
        SYSTEM_PROMPT: '', MAX_CONTEXT_TOKENS: 100000, SUMMARY_TRIGGER_TOKENS: 90000,
        REQUEST_TIMEOUT_MS: 1000,
        isAbortError: error => error.name === 'AbortError',
        createAdapter: config => {
            const role = config ? `delegate-${delegateIndex++}` : 'main';
            const queue = config ? delegates[delegateIndex - 1] : steps;
            return { supportsSessionToolLoop: session, async chat(task) {
                requests.push({ role, ...structuredClone({ tools: task.tools, messages: task.messages, toolResponses: task.toolResponses }) });
                assert.ok(queue?.length, 'No unplanned model retries');
                return queue.shift();
            } };
        },
        post(type, payload) {
            if (type !== 'xb-assistant:tool-call') return;
            dispatched.push(payload);
            const result = payload.name === TOOL_NAMES.READ_SKILL
                ? results[payload.arguments.id] || { ok: true, builtin: true, id: payload.arguments.id, content: 'Fixture skill.' }
                : { ok: true };
            queueMicrotask(() => pendingToolCalls.get(payload.requestId).resolve(result));
        },
    });
    return { state, runtime, requests, dispatched, start: () => runtime.runAssistantLoop(run) };
}

for (const session of [false, true]) test(`skill availability updates on the next request and restarts retained tool sessions (${session})`, async t => {
    const h = harness(t, { session, steps: [
        step(readSkill('builtin-live-page'), call(TOOL_NAMES.INSPECT_PAGE)),
        step(call(TOOL_NAMES.INSPECT_PAGE)),
        done,
    ] });
    await h.start();
    assert.equal(names(h.requests[0]).has(TOOL_NAMES.INSPECT_PAGE), false);
    assert.equal(names(h.requests[0]).has(TOOL_NAMES.READ_LOGS), true);
    assert.equal(names(h.requests[1]).has(TOOL_NAMES.INSPECT_PAGE), true);
    assert.equal(names(h.requests[1]).has(TOOL_NAMES.CARD_FILES), true);
    assert.ok(h.requests[1].messages?.length, 'Changed tools require cold replay, including the receipt');
    assert.equal(h.requests[1].toolResponses, undefined);
    if (session) assert.equal(h.requests[2].toolResponses.length, 1, 'Unchanged tools retain the efficient session continuation');
    assert.equal(h.dispatched.filter(item => item.name === TOOL_NAMES.INSPECT_PAGE).length, 1);
    const denied = h.state.messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content))
        .find(result => result.error === 'skill_tool_not_available');
    assert.equal(denied.toolName, TOOL_NAMES.INSPECT_PAGE);
});

for (const receipt of [{ ok: false, id: 'builtin-live-page', builtin: true }, { ok: true, id: 'builtin-live-page' }]) {
    test(`failed or nonbuiltin receipt cannot unlock tools (${JSON.stringify(receipt)})`, async t => {
        const h = harness(t, { results: { 'builtin-live-page': receipt },
            steps: [step(readSkill('builtin-live-page')), step(call(TOOL_NAMES.INSPECT_PAGE)), done] });
        await h.start();
        assert.equal(h.requests.every(request => !names(request).has(TOOL_NAMES.INSPECT_PAGE)), true);
        assert.equal(h.dispatched.some(item => item.name === TOOL_NAMES.INSPECT_PAGE), false);
    });
}

test('slash-triggered successful ReadSkill activates tools before the first model request', async t => {
    const h = harness(t, { user: '/card', skills: [{ id: 'builtin-card-files', slashTriggers: ['/card'] }],
        steps: [step(call(TOOL_NAMES.CARD_FILES)), done] });
    await h.start();
    assert.equal(names(h.requests[0]).has(TOOL_NAMES.CARD_FILES), true);
    assert.deepEqual(h.dispatched.map(item => item.name), [TOOL_NAMES.READ_SKILL, TOOL_NAMES.CARD_FILES]);
});

test('discarded future receipts stop enabling tools without a mutable activation flag', async t => {
    const steps = [step(readSkill('builtin-card-files')), done];
    const h = harness(t, { steps });
    await h.start();
    h.state.messages = h.state.messages.slice(0, 1);
    steps.push(step(call(TOOL_NAMES.CARD_FILES)), done);
    await h.start();
    assert.equal(names(h.requests[2]).has(TOOL_NAMES.CARD_FILES), false);
    assert.equal(h.dispatched.some(item => item.name === TOOL_NAMES.CARD_FILES), false);
});

test('parent and sibling delegates have isolated receipt-derived activation and coordination remains main-only', async t => {
    const h = harness(t, { session: true, archivedSkillIds: ['builtin-planning', 'builtin-card-files'],
        steps: [step(call(TOOL_NAMES.DELEGATE_RUN, { task: 'First bounded task' })),
            step(call(TOOL_NAMES.DELEGATE_RUN, { task: 'Second bounded task' })),
            step(call(TOOL_NAMES.INSPECT_PAGE)), done],
        delegates: [
            [step(call(TOOL_NAMES.CARD_FILES)), step(readSkill('builtin-live-page')), step(call(TOOL_NAMES.INSPECT_PAGE)), done],
            [step(call(TOOL_NAMES.INSPECT_PAGE), readSkill('builtin-planning')), done],
        ],
    });
    await h.start();
    const first = h.requests.filter(item => item.role === 'delegate-0');
    const second = h.requests.filter(item => item.role === 'delegate-1');
    assert.equal(names(first[0]).has(TOOL_NAMES.CARD_FILES), false, 'Parent activation is not inherited');
    assert.equal(names(first[2]).has(TOOL_NAMES.INSPECT_PAGE), true);
    assert.ok(first[2].messages?.length, 'Delegate session replays after activation');
    assert.equal(first[2].toolResponses, undefined);
    assert.equal(names(second[0]).has(TOOL_NAMES.INSPECT_PAGE), false, 'Sibling activation is not inherited');
    assert.equal(h.requests.filter(item => item.role === 'main').every(item => !names(item).has(TOOL_NAMES.INSPECT_PAGE)), true);
    for (const request of [...first, ...second]) {
        assert.equal(names(request).has(TOOL_NAMES.DELEGATE_RUN), false);
        assert.equal(names(request).has(TOOL_NAMES.PLAN_CREATE), false);
    }
    assert.equal(h.dispatched.filter(item => item.name === TOOL_NAMES.INSPECT_PAGE).length, 1);
    assert.equal(h.dispatched.some(item => item.name === TOOL_NAMES.CARD_FILES), false);
    assert.equal(h.state.messages.some(message => message.toolName === TOOL_NAMES.READ_SKILL), false, 'Delegate receipts stay outside parent history');
});
