import {
    TASK_CANCELLED_SUMMARY,
    assertFreshTaskIdentities,
    normalizeObservedAssistantCount,
    normalizeTaskActionId,
    normalizeTaskCandidates,
    normalizeTaskCas,
    normalizeTaskIdentity,
    requireTaskCommandKeys,
    sameTaskValue,
    validateTaskDomain,
} from '../invariants.js';
import { projectTaskRecord } from '../projection.js';
import { TaskError, type AssignTaskCandidateInput, type CancelTaskInput, type ReplaceTaskCandidatesInput,
    type TaskCommandEnvironment, type TaskCommandResult, type TaskDomainV1, type TaskEvent } from '../types.js';
import { appendTaskEvent, taskEventPredecessor, taskReplayResult } from './create.js';

function currentRecord(domain: TaskDomainV1, taskId: string) {
    const record = projectTaskRecord(domain, taskId);
    if (!record) {throw new TaskError('task_task_missing');}
    return record;
}

function assertRecruiting(record: ReturnType<typeof currentRecord>): void {
    if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') {
        throw new TaskError('task_terminal');
    }
    if (record.status !== 'recruiting') {throw new TaskError('task_task_not_recruiting');}
    if (record.source !== 'published' || record.issuer.kind !== 'player') {throw new TaskError('task_player_only');}
}

function assertCas(record: ReturnType<typeof currentRecord>, revision: number, eventId: string): void {
    if (record.taskRevision !== revision) {throw new TaskError('task_revision_conflict');}
    if (record.eventId !== eventId) {throw new TaskError('task_event_id_conflict');}
}

function replayCasMatches(domain: TaskDomainV1, event: TaskEvent, revision: number, eventId: string): boolean {
    const predecessor = taskEventPredecessor(domain, event);
    return !!predecessor && predecessor.taskRevision === revision && predecessor.eventId === eventId;
}

export function replaceTaskCandidates(
    domain: TaskDomainV1,
    input: ReplaceTaskCandidatesInput,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, ['actionId', 'taskId', 'expectedTaskRevision', 'expectedEventId',
        'candidates', 'observedAssistantCount']);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const cas = normalizeTaskCas(command.expectedTaskRevision, command.expectedEventId);
    const candidates = normalizeTaskCandidates(command.candidates);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        if (existing.kind !== 'candidates-replaced' || existing.taskId !== taskId
            || !replayCasMatches(domain, existing, cas.expectedTaskRevision, cas.expectedEventId)
            || existing.observedAssistantCount !== observedAssistantCount
            || !sameTaskValue(existing.candidates, candidates)) {throw new TaskError('task_action_conflict');}
        return taskReplayResult(domain, existing);
    }
    const record = currentRecord(domain, taskId);
    assertRecruiting(record);
    assertCas(record, cas.expectedTaskRevision, cas.expectedEventId);
    assertFreshTaskIdentities(domain, [actionId, ...candidates.map(candidate => candidate.candidateId)]);
    return appendTaskEvent(domain, { kind: 'candidates-replaced', actionId, taskId,
        observedAssistantCount, candidates }, environment);
}

export function assignTaskCandidate(
    domain: TaskDomainV1,
    input: AssignTaskCandidateInput,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, ['actionId', 'taskId', 'expectedTaskRevision', 'expectedEventId',
        'candidateId', 'observedAssistantCount']);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const cas = normalizeTaskCas(command.expectedTaskRevision, command.expectedEventId);
    const candidateId = normalizeTaskIdentity(command.candidateId);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        if (existing.kind !== 'assigned' || existing.taskId !== taskId || existing.assignee.partyId !== candidateId
            || !replayCasMatches(domain, existing, cas.expectedTaskRevision, cas.expectedEventId)
            || existing.observedAssistantCount !== observedAssistantCount) {throw new TaskError('task_action_conflict');}
        return taskReplayResult(domain, existing);
    }
    const record = currentRecord(domain, taskId);
    assertRecruiting(record);
    assertCas(record, cas.expectedTaskRevision, cas.expectedEventId);
    const candidate = record.candidates.find(entry => entry.candidateId === candidateId);
    if (!candidate) {throw new TaskError('task_candidate_missing');}
    assertFreshTaskIdentities(domain, [actionId]);
    return appendTaskEvent(domain, { kind: 'assigned', actionId, taskId, observedAssistantCount,
        assignee: { kind: 'world', partyId: candidate.candidateId, displayName: candidate.name,
            description: candidate.description, pitch: candidate.pitch, capability: candidate.capability,
            risk: candidate.risk } }, environment);
}

export function cancelTask(
    domain: TaskDomainV1,
    input: CancelTaskInput,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, ['actionId', 'taskId', 'expectedTaskRevision', 'expectedEventId',
        'observedAssistantCount']);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const cas = normalizeTaskCas(command.expectedTaskRevision, command.expectedEventId);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        if (existing.kind !== 'cancelled' || existing.taskId !== taskId
            || !replayCasMatches(domain, existing, cas.expectedTaskRevision, cas.expectedEventId)
            || existing.observedAssistantCount !== observedAssistantCount) {throw new TaskError('task_action_conflict');}
        return taskReplayResult(domain, existing);
    }
    const record = currentRecord(domain, taskId);
    if (record.status !== 'active' && record.status !== 'recruiting') {throw new TaskError('task_terminal');}
    assertCas(record, cas.expectedTaskRevision, cas.expectedEventId);
    assertFreshTaskIdentities(domain, [actionId]);
    return appendTaskEvent(domain, { kind: 'cancelled', actionId, taskId, observedAssistantCount,
        resultSummary: TASK_CANCELLED_SUMMARY }, environment);
}
