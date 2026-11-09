import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticBuffer, diagnosticText, captureDocument } from '../recorder';
import { LOG_BUDGET_CHARS, LOG_LIMIT } from '../contract';
import { getAssistantToolDefinitions, TOOL_NAMES } from '../../assistant/app-src/tooling.js';
import { LIVE_PAGE_SKILL } from '../tool-contract';
import { toolOutcome } from '../../assistant/app-src/ui/tool-activity.js';

test('diagnostics bound global retained data, disclose loss, and release frame records', () => {
    const buffer = new DiagnosticBuffer();
    for (let n = 0; n < LOG_LIMIT * 3; n++) {
        buffer.add(n % 2 ? 'a' : 'b', 'doc', 'error', 'x'.repeat(1500));
    }
    const a = buffer.read('a'), b = buffer.read('b');
    assert.ok(a.retention.chars <= LOG_BUDGET_CHARS);
    assert.ok(a.records.length + b.records.length <= LOG_LIMIT);
    assert.ok(a.retention.evicted > 0);
    buffer.remove('a');
    assert.equal(buffer.read('a').records.length, 0);
    assert.equal(buffer.read('b').records.length, b.records.length);
    buffer.add('b', 'doc', 'error', 'z'.repeat(LOG_BUDGET_CHARS + 200));
    assert.equal(buffer.read('b').records.at(-1)?.omittedChars, 200);
    buffer.clear();
    assert.equal(buffer.read('b').retention.chars, 0);
    assert.equal(buffer.read('b').records.length, 0);
});

test('console capture does not call getters, swallow events or replace console results', () => {
    let getters = 0, calls = 0;
    const value = { get dangerous() { getters++; throw new Error('side effect'); } };
    diagnosticText(value);
    assert.equal(getters, 0);
    const target = new EventTarget();
    const original = (...args: unknown[]) => { calls++; return args.length; };
    const win = Object.assign(target, { console: { warn: original, error: original } }) as unknown as Window;
    const entries: { kind: string; detail: string }[] = [];
    const stop = captureDocument(win, (kind, detail) => entries.push({ kind, detail }));
    assert.equal((win as Window & { console: Console }).console.warn(value), 1);
    assert.equal(getters, 0);
    assert.equal(calls, 1);
    const event = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: new Error('rejected') });
    win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(entries.map(entry => entry.kind), ['console.warn', 'unhandledrejection']);
    assert.ok(entries[1].detail.includes('recorder.test.ts'));
    stop();
    assert.equal((win as Window & { console: Console }).console.warn, original);
    win.dispatchEvent(event);
    assert.equal(entries.length, 2);
});

test('read-only page tool remains offered without JS permission and reports cancellation honestly', () => {
    const definitions = getAssistantToolDefinitions({ jsApiEnabled: false, skillIds: [LIVE_PAGE_SKILL.id] });
    assert.ok(definitions.some(tool => tool.function.name === TOOL_NAMES.INSPECT_PAGE));
    assert.ok(!definitions.some(tool => tool.function.name === TOOL_NAMES.RUN_JAVASCRIPT_API));
    assert.equal(toolOutcome({ error: 'tool_aborted' }, TOOL_NAMES.INSPECT_PAGE).status, 'stopped');
    assert.equal(toolOutcome({ error: 'tool_timeout' }, TOOL_NAMES.INSPECT_PAGE).status, 'failed');
});
