import {
    assertFreshTaskIdentities,
    normalizeObservedAssistantCount,
    normalizeTaskActionId,
    normalizeTaskCas,
    normalizeTaskIdentity,
    normalizeTaskProgressSummary,
    normalizeTaskResultSummary,
    requireTaskCommandKeys,
    validateTaskDomain,
} from '../invariants.js';
import { projectTaskRecord } from '../projection.js';
import { TaskError, type CompleteTaskInput, type FailTaskInput, type ProgressTaskInput,
    type TaskCommandEnvironment, type TaskCommandResult, type TaskDomainV1, type TaskEvent } from '../types.js';
import { appendTaskEvent, taskEventPredecessor, taskReplayResult } from './create.js';

type MaintenanceKind = 'progressed' | 'completed' | 'failed';

function summaryOf(event: TaskEvent): string | null {
    if (event.kind === 'progressed') {return event.progressSummary;}
    if (event.kind === 'completed' || event.kind === 'failed') {return event.resultSummary;}
    return null;
}

function maintainTask(
    domain: TaskDomainV1,
    input: ProgressTaskInput | CompleteTaskInput | FailTaskInput,
    environment: TaskCommandEnvironment,
    kind: MaintenanceKind,
): TaskCommandResult {
    validateTaskDomain(domain);
    const summaryKey = kind === 'progressed' ? 'progressSummary' : 'resultSummary';
    const command = requireTaskCommandKeys(input, ['actionId', 'taskId', 'expectedTaskRevision', 'expectedEventId',
        summaryKey, 'observedAssistantCount']);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const cas = normalizeTaskCas(command.expectedTaskRevision, command.expectedEventId);
    const summary = kind === 'progressed'
        ? normalizeTaskProgressSummary(command[summaryKey])
        : normalizeTaskResultSummary(command[summaryKey]);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        const predecessor = taskEventPredecessor(domain, existing);
        if (existing.kind !== kind || existing.taskId !== taskId || summaryOf(existing) !== summary
            || existing.observedAssistantCount !== observedAssistantCount || !predecessor
            || predecessor.taskRevision !== cas.expectedTaskRevision || predecessor.eventId !== cas.expectedEventId) {
            throw new TaskError('task_action_conflict');
        }
        return taskReplayResult(domain, existing);
    }
    const record = projectTaskRecord(domain, taskId);
    if (!record) {throw new TaskError('task_task_missing');}
    if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') {
        throw new TaskError('task_terminal');
    }
    if (record.status !== 'active') {throw new TaskError('task_task_not_active');}
    if (record.taskRevision !== cas.expectedTaskRevision) {throw new TaskError('task_revision_conflict');}
    if (record.eventId !== cas.expectedEventId) {throw new TaskError('task_event_id_conflict');}
    if (kind === 'progressed' && record.progressSummary === summary) {
        return { domain: structuredClone(domain), event: null, record, changed: false };
    }
    assertFreshTaskIdentities(domain, [actionId]);
    if (kind === 'progressed') {
        return appendTaskEvent(domain, { kind, actionId, taskId, observedAssistantCount,
            progressSummary: summary }, environment);
    }
    return appendTaskEvent(domain, { kind, actionId, taskId, observedAssistantCount,
        resultSummary: summary }, environment);
}

export function progressTask(domain: TaskDomainV1, input: ProgressTaskInput, environment: TaskCommandEnvironment): TaskCommandResult {
    return maintainTask(domain, input, environment, 'progressed');
}

export function completeTask(domain: TaskDomainV1, input: CompleteTaskInput, environment: TaskCommandEnvironment): TaskCommandResult {
    return maintainTask(domain, input, environment, 'completed');
}

export function failTask(domain: TaskDomainV1, input: FailTaskInput, environment: TaskCommandEnvironment): TaskCommandResult {
    return maintainTask(domain, input, environment, 'failed');
}
