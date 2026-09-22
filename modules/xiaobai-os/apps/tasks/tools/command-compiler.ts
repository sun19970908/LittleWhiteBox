import {
    MAX_TASK_PROGRESS_SUMMARY_LENGTH,
    MAX_TASK_RESULT_SUMMARY_LENGTH,
    normalizeTaskIdentity,
    normalizeTaskProgressSummary,
    normalizeTaskResultSummary,
} from '../../../domains/tasks/invariants.js';
import type { TaskRecord } from '../../../domains/tasks/types.js';
import type { TaskMaintenanceCommand } from '../application/service.js';
import { appliedTaskToolResult, failedTaskToolResult, type TaskToolResult } from './result.js';
import { TASK_MAINTENANCE_TOOL_NAMES } from './tool-contract.js';

type UnknownRecord = Record<string, unknown>;

export interface TaskCommandCompileContext {
    readonly records: ReadonlyMap<string, TaskRecord>;
    readonly staged: ReadonlyMap<string, TaskMaintenanceCommand>;
    readonly createActionId: () => string;
}

export interface TaskCommandCompileResult {
    readonly result: TaskToolResult;
    readonly command?: TaskMaintenanceCommand;
    readonly taskId?: string;
}

function isPlainRecord(value: unknown): value is UnknownRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {return false;}
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function summaryLimit(name: 'progressSummary' | 'resultSummary'): number {
    return name === 'progressSummary' ? MAX_TASK_PROGRESS_SUMMARY_LENGTH : MAX_TASK_RESULT_SUMMARY_LENGTH;
}

function normalizeSummary(value: unknown, name: 'progressSummary' | 'resultSummary'): string | null {
    if (typeof value !== 'string') {return null;}
    const normalized = value
        .normalize('NFKC')
        .replace(/\r\n?|\u2028|\u2029/gu, '\n')
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/gu, ' ')
        .trim();
    if (!normalized) {return null;}
    if (Array.from(normalized).length > summaryLimit(name)) {throw new RangeError('summary_too_long');}
    return name === 'progressSummary'
        ? normalizeTaskProgressSummary(normalized)
        : normalizeTaskResultSummary(normalized);
}

function sameCommand(left: TaskMaintenanceCommand, right: TaskMaintenanceCommand): boolean {
    if (left.kind !== right.kind || left.taskId !== right.taskId
        || left.expectedTaskRevision !== right.expectedTaskRevision
        || left.expectedEventId !== right.expectedEventId) {return false;}
    if (left.kind === 'progress' && right.kind === 'progress') {
        return left.progressSummary === right.progressSummary;
    }
    return left.kind !== 'progress' && right.kind !== 'progress'
        && left.resultSummary === right.resultSummary;
}

export function compileTaskMaintenanceCommand(
    toolName: string,
    args: unknown,
    context: TaskCommandCompileContext,
): TaskCommandCompileResult {
    if (!isPlainRecord(args)) {return { result: failedTaskToolResult('arguments_must_be_object') };}
    const summaryName = toolName === TASK_MAINTENANCE_TOOL_NAMES.PROGRESS
        ? 'progressSummary'
        : toolName === TASK_MAINTENANCE_TOOL_NAMES.COMPLETE || toolName === TASK_MAINTENANCE_TOOL_NAMES.FAIL
            ? 'resultSummary'
            : null;
    if (!summaryName) {throw new TypeError(`Unknown Tasks maintenance tool: ${toolName}`);}

    let taskId = '';
    try {taskId = normalizeTaskIdentity(args.taskId);} catch {
        return { result: failedTaskToolResult('task_id_required') };
    }
    const allowed = new Set(['taskId', 'revision', summaryName]);
    if (Object.keys(args).some(key => !allowed.has(key))) {
        return { taskId, result: failedTaskToolResult('unsupported_fields', taskId) };
    }
    const record = context.records.get(taskId);
    if (!record) {return { taskId, result: failedTaskToolResult('task_not_in_session', taskId) };}
    if (!Number.isSafeInteger(args.revision) || Number(args.revision) < 1) {
        return { taskId, result: failedTaskToolResult('revision_invalid', taskId) };
    }
    if (Number(args.revision) !== record.taskRevision) {
        return { taskId, result: failedTaskToolResult('revision_conflict', taskId) };
    }
    if (record.status !== 'active') {
        return { taskId, result: failedTaskToolResult('task_not_active', taskId) };
    }
    let summary: string | null;
    try {summary = normalizeSummary(args[summaryName], summaryName);} catch {
        return { taskId, result: failedTaskToolResult('summary_too_long', taskId) };
    }
    if (!summary) {return { taskId, result: failedTaskToolResult('summary_required', taskId) };}

    const common = {
        actionId: '',
        taskId,
        expectedTaskRevision: record.taskRevision,
        expectedEventId: record.eventId,
    };
    const draft: TaskMaintenanceCommand = toolName === TASK_MAINTENANCE_TOOL_NAMES.PROGRESS
        ? { ...common, kind: 'progress', progressSummary: summary }
        : toolName === TASK_MAINTENANCE_TOOL_NAMES.COMPLETE
            ? { ...common, kind: 'complete', resultSummary: summary }
            : { ...common, kind: 'fail', resultSummary: summary };
    const existing = context.staged.get(taskId);
    if (existing) {
        return sameCommand(existing, draft)
            ? { taskId, result: appliedTaskToolResult(taskId, false) }
            : { taskId, result: failedTaskToolResult('task_command_already_staged', taskId) };
    }
    if (draft.kind === 'progress' && draft.progressSummary === record.progressSummary) {
        return { taskId, result: appliedTaskToolResult(taskId, false) };
    }
    return {
        taskId,
        command: { ...draft, actionId: context.createActionId() },
        result: appliedTaskToolResult(taskId, true),
    };
}
