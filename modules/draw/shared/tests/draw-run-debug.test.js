import assert from 'node:assert/strict';
import test from 'node:test';

import {
    logDrawRunPlannerFailures,
    resetDrawRunPlannerFailureLogsForTests,
} from '../draw-run-debug.js';

test('new Planner validation failures enter the browser console once with the LLM result and schema error', () => {
    resetDrawRunPlannerFailureLogsForTests();
    const entries = [];
    const logger = {
        warn(prefix, details) { entries.push({ prefix, details }); },
    };
    const run = {
        id: 'run-debug-1',
        progress: {
            validationFailures: [{
                attempt: 1,
                errorCode: 'TOOL_ARGUMENTS_SCHEMA_INVALID',
                errorMessage: 'images[0].characters must be an array',
                errorPath: 'images[0].characters',
                errorRule: 'must be an array',
                received: 'none',
                expected: [],
                modelOutput: '{"toolCalls":[{"name":"submit_scene_plan","arguments":"bad"}]}',
                modelOutputTruncated: false,
            }],
        },
    };

    assert.equal(logDrawRunPlannerFailures(run, logger), 1);
    assert.equal(logDrawRunPlannerFailures(run, logger), 0);
    assert.equal(entries.length, 1);
    assert.match(entries[0].prefix, /Tool 返回未通过校验/);
    assert.equal(entries[0].details.errorPath, 'images[0].characters');
    assert.equal(entries[0].details.errorRule, 'must be an array');
    assert.equal(entries[0].details.llmResult.toolCalls[0].name, 'submit_scene_plan');
    assert.equal(entries[0].details.llmResult.toolCalls[0].arguments, 'bad');
});

test('browser console logging does not require the DEBUG monitor to be enabled', () => {
    resetDrawRunPlannerFailureLogsForTests();
    const entries = [];
    const logger = {
        isEnabled: () => false,
        warn(_prefix, details) { entries.push(details); },
    };
    const run = {
        id: 'run-debug-2',
        progress: {
            validationFailures: [{ attempt: 2, errorCode: 'TOOL_CALL_MISSING', modelOutput: '{"text":"plain answer"}' }],
        },
    };

    assert.equal(logDrawRunPlannerFailures(run, logger), 1);
    assert.equal(entries[0].errorCode, 'TOOL_CALL_MISSING');
    assert.equal(entries[0].llmResult.text, 'plain answer');
});
