import assert from 'node:assert/strict';
import test from 'node:test';
import { createHistoryCompactionController } from '../app-src/runtime/history-compaction.js';
import { createContextStatsController } from '../app-src/runtime/context-stats.js';
import { buildProviderMessagesFromHistory } from '../../agent-core/runtime/protocol.js';
import { estimateConversationTokens } from '../../agent-core/runtime/context-tokens.js';
import { createAssistantRuntime } from '../app-src/runtime.js';
import { TOOL_NAMES, TOOL_DEFINITIONS, formatToolResultDisplay } from '../app-src/tooling.js';

// Acceptance contracts:
// - Repeated compaction keeps parallel calls and their replies together (broken provider protocol).
// - Empty/failed/cancelled summary chunks keep the unarchived history and memory (lost work).
// - Oversized final requests never reach the provider; complete tool results remain available (paid failures / lost evidence).
const cycle = (id, size = 6000) => {
    const calls = [0, 1].map(n => ({ id: `${id}-${n}`, name: 'Read', arguments: JSON.stringify({ filePath: `local/${id}-${n}.md` }) }));
    return [{ role: 'assistant', content: '', toolCalls: calls,
        providerPayload: { anthropicContent: [{ type: 'thinking', thinking: 'plan', signature: 'signature' },
            ...calls.map(call => ({ type: 'tool_use', id: call.id, name: call.name, input: JSON.parse(call.arguments) }))] } },
    ...calls.map(call => ({ role: 'tool', toolCallId: call.id, toolName: call.name, content: `${id}:` + 'x'.repeat(size / 2) }))];
};

function harness({ messages, summary = '', threshold = 2500, inputLimit = 5000, respond = () => ({ text: 'memory' }) } = {}) {
    const state = { messages: [{ role: 'user', content: 'Continue the card.' }, ...(messages || Array.from({ length: 5 }, (_, i) => cycle(`c${i}`)).flat())],
        archivedTurnCount: 0, historySummary: summary, archivedSkillIds: [], contextStats: {} };
    const requests = [], saved = [];
    const providerConfig = { provider: 'anthropic', maxTokens: 1000 };
    const controller = createHistoryCompactionController({ state, render() {}, persistSession() { saved.push(structuredClone(state)); }, showToast() {},
        getActiveProviderConfig: () => providerConfig, formatToolResultDisplay: () => ({}), buildTextWithAttachmentSummary: text => text,
        trimForSummary: text => text, SUMMARY_SYSTEM_PROMPT: 'Summarize', compactionThreshold: () => threshold, requestInputLimit: () => inputLimit,
        buildContextMeterLabel: () => '',
        toProviderMessages: messages => [...(state.historySummary ? [{ role: 'system', content: state.historySummary }] : []), ...buildProviderMessagesFromHistory(messages)],
        updateContextStats(messages) { state.contextStats = { usedTokens: estimateConversationTokens({ messages, providerConfig }), budgetTokens: 258000 }; },
    });
    return { state, requests, saved, run: signal => controller.ensureContextBudget({ chat: async request => {
        requests.push(request); return respond(request, requests.length);
    } }, signal) };
}

test('both compaction passes retain complete parallel Anthropic tool groups', async () => {
    const h = harness();
    const result = await h.run(new AbortController().signal);
    const calls = result.flatMap(message => (message.tool_calls || []).map(call => call.id));
    const replies = result.filter(message => message.role === 'tool').map(message => message.tool_call_id);
    assert.deepEqual(calls, ['c4-0', 'c4-1']);
    assert.deepEqual(replies, calls);
    assert.equal(h.saved.length, 2);
    assert.ok(h.state.messages.every(message => !message.providerPayload?.anthropicContent.some(block => block.type === 'thinking')));
});

for (const failure of ['empty-first', 'empty-later', 'error-later', 'cancel-later']) {
    test(`summary ${failure} keeps original memory, messages and persisted state`, async () => {
        const abort = new AbortController();
        const h = harness({ summary: 'original memory', respond: (_request, n) => {
            if (n === (failure === 'empty-first' ? 1 : 2)) {
                if (failure === 'error-later') throw new Error('provider unavailable');
                if (failure === 'cancel-later') abort.abort();
                return { text: '   ' };
            }
            return { text: 'temporary partial summary' };
        } });
        const original = structuredClone(h.state);
        await assert.rejects(h.run(abort.signal), failure === 'cancel-later' ? { name: 'AbortError' } : { code: 'assistant_summary_failed' });
        assert.equal(h.state.historySummary, original.historySummary);
        assert.deepEqual(h.state.messages, original.messages);
        assert.equal(h.state.archivedTurnCount, original.archivedTurnCount);
        assert.equal(h.saved.length, 0);
    });
}

test('a latest batch larger than the input budget is retained and rejected before sending', async () => {
    const stats = createContextStatsController({ state: {}, getActiveProviderConfig: () => ({ maxTokens: 24000 }),
        MAX_CONTEXT_TOKENS: 258000, SUMMARY_TRIGGER_TOKENS: 228000 });
    const latest = cycle('latest', 1000000);
    const h = harness({ messages: [...cycle('older'), ...latest], threshold: stats.compactionThreshold(), inputLimit: stats.requestInputLimit() });
    let sent = false;
    await assert.rejects((async () => { await h.run(new AbortController().signal); sent = true; })(), { code: 'assistant_context_over_budget' });
    assert.equal(sent, false);
    assert.deepEqual(h.state.messages.slice(-2), latest.slice(-2));
    assert.deepEqual(h.saved.at(-1).messages, h.state.messages);
});

test('the main loop never calls the adapter for an oversized current batch', async t => {
    t.mock.method(console, 'error', () => {});
    const run = { id: 'budget', controller: new AbortController(), toolRequestIds: new Set(), workspaceBaseline: [] };
    const state = { messages: [{ role: 'user', content: 'Continue.' }, ...cycle('latest', 1000000)],
        activeRun: run, archivedTurnCount: 0, archivedSkillIds: [] };
    const original = structuredClone(state.messages);
    let sent = 0;
    const runtime = createAssistantRuntime({ state, TOOL_NAMES, TOOL_DEFINITIONS, pendingToolCalls: new Map(), pendingApprovals: new Map(),
        render() {}, persistSession() {}, showToast() {}, createRequestId: () => 'budget-fixture', safeJsonParse: JSON.parse,
        describeError: error => error.message, formatToolResultDisplay, normalizeAttachments: () => [], normalizeThoughtBlocks: () => [],
        buildUserContentParts: message => message.content, normalizeSlashSkillTrigger: () => '',
        getActiveProviderConfig: () => ({ provider: 'openai-compatible', maxTokens: 24000 }), getToolDefinitions: () => TOOL_DEFINITIONS,
        SYSTEM_PROMPT: '', MAX_CONTEXT_TOKENS: 258000, SUMMARY_TRIGGER_TOKENS: 228000, REQUEST_TIMEOUT_MS: 1000,
        isAbortError: error => error.name === 'AbortError', createAdapter: () => ({ chat() { sent++; return { text: 'unexpected request' }; } }),
    });
    await assert.rejects(runtime.runAssistantLoop(run), { code: 'assistant_context_over_budget' });
    assert.equal(sent, 0);
    assert.deepEqual(state.messages, original);
});

test('an oversized running summary stops before sending another chunk and preserves history', async () => {
    const h = harness({ summary: 'original memory', respond: () => ({ text: 'large summary '.repeat(2000) }) });
    const original = structuredClone(h.state.messages);
    await assert.rejects(h.run(new AbortController().signal), { code: 'assistant_summary_failed' });
    assert.equal(h.requests.length, 1);
    assert.equal(h.state.historySummary, 'original memory');
    assert.deepEqual(h.state.messages, original);
    assert.equal(h.saved.length, 0);
});
