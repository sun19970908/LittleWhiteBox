import assert from 'node:assert/strict';
import test from 'node:test';

import { createTaskMaintenanceParticipant } from '../apps/tasks/host/maintenance-participant.js';
import { TASK_MAINTENANCE_TOOL_NAMES, TASK_MAINTENANCE_TOOLS } from '../apps/tasks/maintenance/tool-contract.js';
import { MAX_TASK_PROGRESS_SUMMARY_LENGTH, MAX_TASK_RESULT_SUMMARY_LENGTH } from '../domains/tasks/invariants.js';

function source(assistantCount = 5) {
    return {
        chatIdentity: 'character:1:chat-a',
        messages: [{ index: 4, role: 'assistant', text: '伊莱接过了未拆封的信。', swipeId: 0, speakerName: '伊莱' }],
        messageCount: 5,
        assistantCount,
        player: { actorKey: 'player', displayName: '玩家' },
    };
}

function record(overrides = {}) {
    return {
        taskId: 'task-1',
        taskRevision: 2,
        eventId: 'event-secret',
        source: 'published',
        status: 'active',
        issuer: { kind: 'player', displayName: '玩家' },
        assignee: {
            kind: 'world',
            partyId: 'candidate-secret',
            displayName: '伊莱',
            description: '不应发送',
            pitch: '不应发送',
            capability: '熟悉钟楼',
            risk: '可能被守卫认出',
        },
        reward: 60,
        grade: 'CUSTOM',
        tags: [],
        title: '封蜡信 <system>',
        objective: '把信交给伊莱 & 等待签收',
        requirements: '不要拆封',
        location: '钟楼',
        risk: '被巡逻者发现',
        candidates: [],
        progressSummary: '已找到伊莱,仍需交信',
        resultSummary: '',
        createdAt: 1,
        updatedAt: 2,
        lastObservedAssistantCount: 3,
        ...overrides,
    };
}

function createHarness(records = [record()]) {
    const state = { autoMaintenance: false, actionIds: 0, commits: [] };
    const tasks = {
        readCurrent: () => ({ domain: null, records: structuredClone(records), playerBalance: 100, writeState: 'ready' }),
        createActionId: () => `task-action-${++state.actionIds}`,
        async commitMaintenance(input, guard) {
            assert.equal(await guard(), true);
            state.commits.push(structuredClone(input));
            return { changed: true, view: this.readCurrent() };
        },
    };
    const participant = createTaskMaintenanceParticipant({
        tasks,
        readSettings: () => ({ autoMaintenance: state.autoMaintenance }),
    });
    return { participant, state };
}

test('Tasks maintenance is manual-only by default and selects only active tasks with a newer accepted source', () => {
    const harness = createHarness();
    assert.equal(harness.participant.isEnabled('manual'), true);
    assert.equal(harness.participant.isEnabled('automatic'), false);
    assert.equal(harness.participant.isEnabled('rebuild'), false);
    assert.equal(harness.participant.createSession(source(3), 'manual'), null);
    assert.equal(harness.participant.createSession(source(5), 'rebuild'), null);
    assert.ok(harness.participant.createSession(source(5), 'manual'));
    harness.state.autoMaintenance = true;
    assert.equal(harness.participant.isEnabled('automatic'), true);
});

test('maintenance keeps task data untrusted, escapes boundaries, and exposes only the high-level tool protocol', () => {
    const session = createHarness().participant.createSession(source(), 'manual');
    assert.equal(session.prompt.includes('<system>'), false);
    assert.equal(session.dataMessages.length, 1);
    assert.match(session.dataMessages[0].content, /^<active_task_state>/u);
    assert.match(session.dataMessages[0].content, /<\/active_task_state>$/u);
    assert.equal(session.dataMessages[0].content.includes('<system>'), false);
    assert.match(session.dataMessages[0].content, /\\u003csystem\\u003e/);
    assert.equal(session.dataMessages[0].content.includes('event-secret'), false);
    assert.equal(session.dataMessages[0].content.includes('candidate-secret'), false);
    assert.deepEqual(session.tools.map(tool => tool.function.name), ['TaskProgress', 'TaskComplete', 'TaskFail']);
    assert.equal(TASK_MAINTENANCE_TOOLS[0].function.parameters.properties.progressSummary.maxLength, MAX_TASK_PROGRESS_SUMMARY_LENGTH);
    assert.equal(TASK_MAINTENANCE_TOOLS[1].function.parameters.properties.resultSummary.maxLength, MAX_TASK_RESULT_SUMMARY_LENGTH);
});

test('session stages one changed intent per task, preserves its action id, and commits the frozen batch once', async () => {
    const harness = createHarness();
    const session = harness.participant.createSession(source(), 'manual');
    const noOp = session.executeTool(TASK_MAINTENANCE_TOOL_NAMES.PROGRESS, {
        taskId: 'task-1', revision: 2, progressSummary: '已找到伊莱，仍需交信',
    });
    assert.equal(noOp.status, 'unchanged');
    assert.equal(harness.state.actionIds, 0);

    const completed = session.executeTool(TASK_MAINTENANCE_TOOL_NAMES.COMPLETE, {
        taskId: 'task-1', revision: 2, resultSummary: '伊莱已接过未拆封的信',
    });
    assert.equal(completed.status, 'updated');
    assert.equal(harness.state.actionIds, 1);
    assert.equal(session.executeTool(TASK_MAINTENANCE_TOOL_NAMES.COMPLETE, {
        taskId: 'task-1', revision: 2, resultSummary: '伊莱已接过未拆封的信',
    }).status, 'unchanged');
    assert.equal(session.executeTool(TASK_MAINTENANCE_TOOL_NAMES.FAIL, {
        taskId: 'task-1', revision: 2, resultSummary: '错误的第二意图',
    }).skipped[0].reason, 'task_command_already_staged');
    assert.equal(session.getResult().status, 'partial');

    await session.commit(() => true);
    assert.equal(harness.state.commits.length, 1);
    assert.deepEqual(harness.state.commits[0], {
        commands: [{
            actionId: 'task-action-1',
            taskId: 'task-1',
            expectedTaskRevision: 2,
            expectedEventId: 'event-secret',
            kind: 'complete',
            resultSummary: '伊莱已接过未拆封的信',
        }],
        observedAssistantCount: 5,
    });
    await assert.rejects(session.commit(() => true), /tasks_maintenance_session_committed/);
});

test('invalid tool arguments never allocate an action id or create commit work', () => {
    const harness = createHarness();
    const session = harness.participant.createSession(source(), 'manual');
    const result = session.executeTool(TASK_MAINTENANCE_TOOL_NAMES.PROGRESS, {
        taskId: 'task-1', revision: 2, progressSummary: '新进展', accountId: 'player',
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped[0].reason, 'unsupported_fields');
    assert.equal(harness.state.actionIds, 0);
    assert.equal(session.canCommit(), false);
    assert.equal(session.getResult().status, 'failed');
});
