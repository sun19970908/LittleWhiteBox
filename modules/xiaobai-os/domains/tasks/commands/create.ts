import {
    assertFreshTaskIdentities,
    collectTaskIdentityIds,
    normalizeObservedAssistantCount,
    normalizeTaskActionId,
    normalizeTaskDisplayName,
    normalizeTaskIdentity,
    normalizeTaskBoardListings,
    normalizeTaskPublishedForm,
    normalizeTaskTimestamp,
    requireTaskCommandKeys,
    sameTaskValue,
    validateTaskDomain,
} from '../invariants.js';
import { projectTaskRecord } from '../projection.js';
import {
    TASK_DOMAIN_SCHEMA_VERSION,
    TaskError,
    type AcceptTaskListingInput,
    type PublishTaskInput,
    type ReplaceTaskBoardInput,
    type TaskCommandEnvironment,
    type TaskCommandResult,
    type TaskDomainV1,
    type TaskEvent,
    type TaskEventPayload,
} from '../types.js';

export function taskReplayResult(domain: TaskDomainV1, event: TaskEvent): TaskCommandResult {
    const current = structuredClone(domain);
    const record = projectTaskRecord(current, event.taskId);
    if (!record) {throw new TaskError('task_invalid_domain', 'replay.record');}
    return { domain: current, event: structuredClone(event), record, changed: false };
}

export function taskEventPredecessor(domain: TaskDomainV1, event: TaskEvent): TaskEvent | null {
    if (event.taskRevision === 1) {return null;}
    return domain.events.find(candidate => (
        candidate.taskId === event.taskId && candidate.taskRevision === event.taskRevision - 1
    )) ?? null;
}

export function appendTaskEvent(
    domain: TaskDomainV1,
    payload: TaskEventPayload,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    if (!environment || typeof environment.now !== 'function' || typeof environment.createId !== 'function') {
        throw new TaskError('task_invalid_input', 'environment');
    }
    const createdAt = normalizeTaskTimestamp(environment.now());
    const occupied = collectTaskIdentityIds(domain);
    occupied.add(payload.actionId);
    occupied.add(payload.taskId);
    let eventId = '';
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
        const candidate = normalizeTaskIdentity(environment.createId('event'));
        if (!occupied.has(candidate)) {eventId = candidate; break;}
    }
    if (!eventId) {throw new TaskError('task_id_conflict', 'eventId');}
    const previous = domain.events.filter(event => event.taskId === payload.taskId).at(-1);
    const event = { ...structuredClone(payload), eventId,
        taskRevision: (previous?.taskRevision ?? 0) + 1, createdAt } as TaskEvent;
    const next: TaskDomainV1 = {
        schemaVersion: TASK_DOMAIN_SCHEMA_VERSION,
        revision: domain.revision + 1,
        board: structuredClone(domain.board),
        events: [...structuredClone(domain.events), event],
    };
    validateTaskDomain(next);
    const record = projectTaskRecord(next, event.taskId);
    if (!record) {throw new TaskError('task_invalid_domain', 'created.record');}
    return { domain: next, event: structuredClone(event), record, changed: true };
}

export function replaceTaskBoard(domain: TaskDomainV1, input: ReplaceTaskBoardInput): { domain: TaskDomainV1; board: NonNullable<TaskDomainV1['board']> } {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, ['expectedBoardId', 'boardId', 'listings', 'generatedAt']);
    const expectedBoardId = command.expectedBoardId === null ? null : normalizeTaskIdentity(command.expectedBoardId);
    const boardId = normalizeTaskIdentity(command.boardId);
    const listings = normalizeTaskBoardListings(command.listings);
    const generatedAt = normalizeTaskTimestamp(command.generatedAt);
    if ((domain.board?.boardId ?? null) !== expectedBoardId) {throw new TaskError('task_board_conflict');}
    assertFreshTaskIdentities(domain, [boardId, ...listings.map(listing => listing.listingId)]);
    const board = { boardId, listings, generatedAt };
    const next: TaskDomainV1 = { schemaVersion: TASK_DOMAIN_SCHEMA_VERSION, revision: domain.revision + 1,
        board: structuredClone(board), events: structuredClone(domain.events) };
    validateTaskDomain(next);
    return { domain: next, board: structuredClone(board) };
}

export function acceptTaskListing(
    domain: TaskDomainV1,
    input: AcceptTaskListingInput,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, [
        'actionId', 'taskId', 'boardId', 'listingId', 'playerDisplayName', 'observedAssistantCount',
    ]);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const boardId = normalizeTaskIdentity(command.boardId);
    const listingId = normalizeTaskIdentity(command.listingId);
    const playerDisplayName = normalizeTaskDisplayName(command.playerDisplayName);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        if (existing.kind !== 'accepted' || existing.taskId !== taskId || existing.boardId !== boardId
            || existing.listingId !== listingId || existing.assignee.displayName !== playerDisplayName
            || existing.observedAssistantCount !== observedAssistantCount) {throw new TaskError('task_action_conflict');}
        return taskReplayResult(domain, existing);
    }
    if (!domain.board || domain.board.boardId !== boardId) {throw new TaskError('task_board_missing');}
    const listing = domain.board.listings.find(entry => entry.listingId === listingId);
    if (!listing) {throw new TaskError('task_listing_missing');}
    if (domain.events.some(event => event.kind === 'accepted' && event.boardId === boardId && event.listingId === listingId)) {
        throw new TaskError('task_listing_already_accepted');
    }
    assertFreshTaskIdentities(domain, [actionId, taskId, `board:${taskId}`]);
    return appendTaskEvent(domain, {
        kind: 'accepted', actionId, taskId, observedAssistantCount, boardId, listingId,
        issuer: { kind: 'world', partyId: `board:${taskId}`, displayName: '任务终端托管',
            description: '匿名委托报酬的内部结算来源' },
        assignee: { kind: 'player', displayName: playerDisplayName },
        listing: structuredClone(listing),
    }, environment);
}

export function publishTask(
    domain: TaskDomainV1,
    input: PublishTaskInput,
    environment: TaskCommandEnvironment,
): TaskCommandResult {
    validateTaskDomain(domain);
    const command = requireTaskCommandKeys(input, [
        'actionId', 'taskId', 'form', 'playerDisplayName', 'observedAssistantCount',
    ]);
    const actionId = normalizeTaskActionId(command.actionId);
    const taskId = normalizeTaskIdentity(command.taskId);
    const form = normalizeTaskPublishedForm(command.form);
    const playerDisplayName = normalizeTaskDisplayName(command.playerDisplayName);
    const observedAssistantCount = normalizeObservedAssistantCount(command.observedAssistantCount);
    const existing = domain.events.find(event => event.actionId === actionId);
    if (existing) {
        const expected = { kind: 'published', taskId, issuer: { kind: 'player', displayName: playerDisplayName },
            ...form, observedAssistantCount };
        const actual = existing.kind === 'published' ? { kind: existing.kind, taskId: existing.taskId,
            issuer: existing.issuer, title: existing.title, objective: existing.objective,
            ...(existing.requirements ? { requirements: existing.requirements } : {}), location: existing.location,
            risk: existing.risk, reward: existing.reward, observedAssistantCount: existing.observedAssistantCount } : null;
        if (!actual || !sameTaskValue(actual, expected)) {throw new TaskError('task_action_conflict');}
        return taskReplayResult(domain, existing);
    }
    assertFreshTaskIdentities(domain, [actionId, taskId]);
    return appendTaskEvent(domain, { kind: 'published', actionId, taskId, observedAssistantCount,
        issuer: { kind: 'player', displayName: playerDisplayName }, ...form }, environment);
}
