import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entry } from './helpers/story-summary-entry.js';
import { SUMMARY_FEEDBACK_COPY } from '../feedback-copy.js';

// Acceptance: manual anchor work refreshes its repair destination after settling,
// including saved partial success, without starting automatic paid repair.
function anchorFixture({ llmFailed = 0, taskError = null, switchChat = false, busy = null } = {}) {
    const context = { chatId: 'anchor-chat', chat: [{ mes: 'Source material.' }] };
    const running = new Set(busy ? [busy] : []);
    const state = { taskActive: false, tasksFinished: 0, savedAnchors: 0 };
    const calls = { tasks: 0, acquisitions: 0, releases: 0, extractions: 0, stats: 0, failures: [], checks: [] };
    const guard = {
        isAnyRunning: (...names) => names.some(name => running.has(name)),
        acquire(name) {
            calls.acquisitions++;
            running.add(name);
            return () => { running.delete(name); calls.releases++; };
        },
    };
    const api = entry(['handleAnchorGenerate', 'handleAnchorGenerateNow', 'refreshVectorIntegrity', 'integrityReadVersion'], {
        guard, getContext: () => context,
        getVectorConfig: () => ({ enabled: true, l0Api: { key: 'fixture-key' } }),
        isChatStale: chatId => chatId !== context.chatId,
        ensureCurrentSources: async () => {},
        VECTOR_WRITE_SCOPES: { EMBEDDING: 'embedding' }, ANCHOR_GENERATION_OPERATION: 'anchor-fixture',
        async runVectorGenerationTask(options, run) {
            calls.tasks++;
            state.taskActive = true;
            try {
                await options.ready;
                if (taskError) throw taskError;
                return await run({ signal: new AbortController().signal, commit: task => task() });
            } finally {
                state.taskActive = false;
                state.tasksFinished++;
            }
        },
        isVectorWriteSessionCurrent: () => state.taskActive,
        getAnchorStats: async () => ({ incomplete: 5 }),
        incrementalExtractAtoms: async () => {
            calls.extractions++;
            state.savedAnchors = 1;
            if (switchChat) context.chatId = 'other-chat';
            return { built: 1, llmFailed, cancelled: false, failureCode: llmFailed ? 'fixture_failure' : null };
        },
        sendAnchorStatsToFrame: async () => { calls.stats++; },
        checkVectorIntegrity: async options => {
            calls.checks.push({ readOnly: options.readOnly, allowEventRepair: options.allowEventRepair,
                allowChunkRepair: options.allowChunkRepair, requestCurrent: options.requestCurrent(),
                taskActive: state.taskActive, tasksFinished: state.tasksFinished,
                guardHeld: guard.isAnyRunning('anchor', 'vector'), releases: calls.releases, savedAnchors: state.savedAnchors });
        },
        reportMemorySaveFailure: error => calls.failures.push(error),
        shouldNotifyMemoryFailure: error => { throw error; },
        formatSafeFailure: code => code, getL0FailureAdvice: () => '',
        postToFrame() {}, executeSlashCommand: async () => {},
        xbLog: { error() {}, warn() {} }, MODULE_ID: 'anchor-fixture', SUMMARY_FEEDBACK_COPY,
        publishVectorIntegrity: () => assert.fail('unexpected integrity read failure'),
    });
    return { api, calls, guard };
}

function assertReadOnlyRefresh(calls, savedAnchors) {
    assert.deepEqual(calls.checks, [{ readOnly: true, allowEventRepair: false, allowChunkRepair: false,
        requestCurrent: true, taskActive: false, tasksFinished: 1, guardHeld: false, releases: 1, savedAnchors }]);
}

for (const llmFailed of [0, 2]) {
    test(`manual anchors refresh after ${llmFailed ? 'saved partial success' : 'successful completion'} and after releasing task ownership`, async () => {
        const { api, calls } = anchorFixture({ llmFailed });
        await api.handleAnchorGenerate();
        assert.equal(calls.tasks, 1);
        assert.equal(calls.extractions, 1);
        assert.equal(calls.stats, 1);
        assert.deepEqual(calls.failures, []);
        assertReadOnlyRefresh(calls, 1);
    });
}

test('a rejected manual anchor task still releases ownership before its read-only refresh', async () => {
    const failure = new Error('task rejected');
    const { api, calls } = anchorFixture({ taskError: failure });
    await api.handleAnchorGenerate();
    assert.equal(calls.tasks, 1);
    assert.equal(calls.extractions, 0);
    assert.deepEqual(calls.failures, [failure]);
    assertReadOnlyRefresh(calls, 0);
});

test('manual anchor completion after switching chats does not refresh the new chat', async () => {
    const { api, calls, guard } = anchorFixture({ switchChat: true });
    await api.handleAnchorGenerate();
    assert.equal(calls.tasks, 1);
    assert.equal(calls.extractions, 1);
    assert.equal(calls.releases, 1);
    assert.equal(guard.isAnyRunning('anchor', 'vector'), false);
    assert.deepEqual(calls.failures, []);
    assert.deepEqual(calls.checks, []);
});

for (const busy of ['anchor', 'vector']) {
    test(`a busy ${busy} task prevents new manual anchor work or integrity reads`, async () => {
        const { api, calls, guard } = anchorFixture({ busy });
        await api.handleAnchorGenerate();
        assert.equal(calls.tasks, 0);
        assert.equal(calls.acquisitions, 0);
        assert.equal(calls.extractions, 0);
        assert.equal(calls.releases, 0);
        assert.equal(guard.isAnyRunning(busy), true);
        assert.deepEqual(calls.checks, []);
    });
}
