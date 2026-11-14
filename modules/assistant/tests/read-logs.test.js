import test from 'node:test';
import assert from 'node:assert/strict';
import { xbLog } from '../../../core/debug-core.js';
import { readLogs } from '../../debug-panel/log-tool.js';
import { createAssistantRuntime } from '../app-src/runtime.js';
import { TOOL_NAMES, getAssistantToolDefinitions, formatToolResultDisplay } from '../app-src/tooling.js';
import { TOOL_RESULT_PAGE_CHARS } from '../../agent-core/runtime/tool-result-pages.js';

// 验收契约见 debug-panel/README.md：禁用 JS 仍可读取；只读；长结果完整进入模型下一轮。
for (const session of [false, true]) {
    for (const paged of [false, true]) {
        test(`ReadLogs reaches the model without JS permission (session=${session}, paged=${paged})`, async t => {
            t.mock.method(console, 'info', () => {});
            xbLog.clear();
            xbLog.error('scheduledTasks', paged ? 'e'.repeat(TOOL_RESULT_PAGE_CHARS + 500) : 'task failed', new Error('fixture'));
            const before = xbLog.getAll();
            const run = { id: 'read-logs', controller: new AbortController(), toolRequestIds: new Set(), workspaceBaseline: [] };
            const state = { activeRun: run, config: { permissionMode: 'default' }, messages: [{ role: 'user', content: 'Read the error logs.' }], archivedTurnCount: 0 };
            const pending = new Map(), requests = [], hostCalls = [], receipts = [];
            let sequence = 0;
            const call = (name, args) => ({ text: '', toolCalls: [{ id: String(++sequence), name, arguments: JSON.stringify(args) }] });
            const runtime = createAssistantRuntime({
                state, TOOL_NAMES, pendingToolCalls: pending, pendingApprovals: new Map(),
                render() {}, persistSession() {}, createRequestId: () => String(++sequence),
                safeJsonParse: JSON.parse, describeError: error => error.message,
                formatToolResultDisplay, normalizeAttachments: () => [], normalizeThoughtBlocks: () => [],
                buildUserContentParts: message => message.content,
                getActiveProviderConfig: () => ({}), getToolDefinitions: () => getAssistantToolDefinitions({ jsApiEnabled: false }),
                isJsApiEnabled: () => false,
                SYSTEM_PROMPT: '', MAX_CONTEXT_TOKENS: 100000, SUMMARY_TRIGGER_TOKENS: 90000,
                REQUEST_TIMEOUT_MS: 1000,
                isAbortError: error => error.name === 'AbortError',
                createAdapter: () => ({ supportsSessionToolLoop: session, async chat(task) {
                    requests.push(task);
                    assert.ok(task.tools.some(tool => tool.function.name === TOOL_NAMES.READ_LOGS));
                    assert.ok(!task.tools.some(tool => tool.function.name === TOOL_NAMES.RUN_JAVASCRIPT_API));
                    if (requests.length === 1) return call(TOOL_NAMES.READ_LOGS, {});
                    const message = session ? task.toolResponses.at(-1) : task.messages.filter(item => item.role === 'tool').at(-1);
                    const receipt = session ? message.response : JSON.parse(message.content);
                    receipts.push(receipt);
                    if (receipt.data?.nextOffset !== null && receipt.data?.reference) {
                        return call(TOOL_NAMES.TOOL_RESULT_READ, { reference: receipt.data.reference, offset: receipt.data.nextOffset });
                    }
                    return { text: 'Read.', toolCalls: [] };
                } }),
                post(type, payload) {
                    assert.equal(type, 'xb-assistant:tool-call');
                    hostCalls.push(payload.name);
                    assert.equal(payload.name, TOOL_NAMES.READ_LOGS);
                    pending.get(payload.requestId).resolve(structuredClone(readLogs()));
                },
            });
            await runtime.runAssistantLoop(run);
            assert.deepEqual(hostCalls, [TOOL_NAMES.READ_LOGS]);
            const result = paged ? JSON.parse(receipts.map(receipt => receipt.data.text).join('')) : receipts[0];
            assert.equal(result.ok, true);
            assert.equal(result.enabled, true);
            assert.equal(result.maxSize, 100);
            assert.deepEqual(result.logs, before);
            assert.deepEqual(xbLog.getAll(), before);
            assert.equal(state.pendingApprovals?.size || 0, 0);
        });
    }
}
