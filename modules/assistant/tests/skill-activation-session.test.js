import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionStore } from '../app-src/state/session-store.js';
import { createHistoryCompactionController } from '../app-src/runtime/history-compaction.js';
import db, { sessionsTable } from '../shared/session-db.js';
import { loadedSkillIds } from '../shared/skill-tools.js';

// Contract: destructive compaction checkpoints confirmed skill IDs, never prose, in the same persisted session.
// Reopening preserves both compacted and active receipts; clear rotates the session and drops activation.
function receipt(id, suffix) {
    return [
        { role: 'assistant', content: '', toolCalls: [{ id: suffix, name: 'ReadSkill', arguments: JSON.stringify({ id }) }] },
        { role: 'tool', toolName: 'ReadSkill', toolCallId: suffix, content: JSON.stringify({ ok: true, builtin: true, id, content: 'Fixture.' }) },
    ];
}

async function harness() {
    await db.delete();
    await db.open();
    const state = { assistantSessionId: '', messages: [], historySummary: '', archivedTurnCount: 0, archivedSkillIds: [], contextStats: {} };
    let compaction;
    const store = createSessionStore({ state, createRequestId: () => 'restored-tool',
        normalizeAttachments: values => values || [], normalizeThoughtBlocks: values => values || [],
        getActiveContextMessages: () => compaction ? compaction.getActiveContextMessages() : state.messages });
    compaction = createHistoryCompactionController({
        state, render() {}, showToast() {}, persistSession: store.persistSession,
        getActiveProviderConfig: () => ({}), formatToolResultDisplay: () => ({}), buildTextWithAttachmentSummary: text => text,
        trimForSummary: text => text, SUMMARY_SYSTEM_PROMPT: '', compactionThreshold: () => 100, requestInputLimit: () => 100000,
        buildContextMeterLabel: () => '', toProviderMessages: messages => messages,
        updateContextStats() { state.contextStats.usedTokens = state.messages.length > 3 ? 200 : 1; },
    });
    await store.restoreSession();
    return { state, store, compaction };
}

for (const failed of [false, true]) test(`confirmed skill receipts survive ${failed ? 'failed' : 'successful'} compaction and IndexedDB reopening`, async () => {
    const { state, store, compaction } = await harness();
    state.messages = [
        { role: 'user', content: 'Earlier task.' }, ...receipt('builtin-card-files', 'archived'),
        { role: 'assistant', content: 'Earlier answer.' },
        { role: 'user', content: 'Current task.' }, ...receipt('builtin-live-page', 'active'),
    ];
    await store.persistSession();
    const original = structuredClone(state.messages);
    const compact = compaction.ensureContextBudget({ async chat() {
        if (failed) throw new Error('fixture summary outage');
        return { text: 'A prose summary mentions builtin-planning but contains no skill receipt.' };
    } }, new AbortController().signal);
    if (failed) await assert.rejects(compact, { code: 'assistant_summary_failed' });
    else await compact;
    const archived = failed ? [] : ['builtin-card-files'];
    if (failed) assert.deepEqual(state.messages, original);
    else assert.equal(state.messages.length, 3);
    assert.deepEqual(state.archivedSkillIds, archived);
    assert.deepEqual(loadedSkillIds(state.messages, state.archivedSkillIds), ['builtin-card-files', 'builtin-live-page']);
    await store.persistSession();
    const stored = await sessionsTable.get(state.assistantSessionId);
    assert.deepEqual(stored.archivedSkillIds, archived);
    state.messages = [];
    state.archivedSkillIds = [];
    await store.restoreSession();
    assert.deepEqual(state.archivedSkillIds, archived);
    if (failed) {
        assert.equal(state.messages.length, original.length);
        original.forEach((message, index) => {
            for (const key of Object.keys(message)) assert.deepEqual(state.messages[index][key], message[key]);
        });
        assert.equal(state.historySummary, '');
    }
    assert.deepEqual(loadedSkillIds(state.messages, state.archivedSkillIds), ['builtin-card-files', 'builtin-live-page']);
    assert.equal(loadedSkillIds(state.messages, state.archivedSkillIds).includes('builtin-planning'), false);
    const oldSessionId = state.assistantSessionId;
    const cleared = await store.clearSession();
    assert.equal(cleared.ok, true);
    assert.notEqual(state.assistantSessionId, oldSessionId);
    assert.deepEqual(state.archivedSkillIds, []);
    assert.deepEqual(loadedSkillIds(state.messages, state.archivedSkillIds), []);
    await store.restoreSession();
    assert.deepEqual(state.archivedSkillIds, []);
});

test('cancelled compaction leaves receipts and checkpoint unchanged', async () => {
    const { state, compaction } = await harness();
    state.messages = [{ role: 'user', content: 'Earlier.' }, ...receipt('builtin-card-files', 'before-cancel'),
        { role: 'assistant', content: 'Answered.' }, { role: 'user', content: 'Current.' }];
    const original = structuredClone(state.messages);
    const controller = new AbortController();
    await assert.rejects(compaction.ensureContextBudget({ async chat() {
        controller.abort();
        return { text: 'Late summary.' };
    } }, controller.signal), { name: 'AbortError' });
    assert.deepEqual(state.archivedSkillIds, []);
    assert.deepEqual(state.messages, original);
    assert.equal(state.historySummary, '');
});
