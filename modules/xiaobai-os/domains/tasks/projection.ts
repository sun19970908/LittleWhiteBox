import {
    TaskError,
    type TaskDomainV1,
    type TaskEvent,
    type TaskRecord,
} from './types.js';

function invalid(detail: string): never {
    throw new TaskError('task_invalid_domain', detail);
}

function applyTaskEvent(records: Map<string, TaskRecord>, event: TaskEvent): void {
    const current = records.get(event.taskId);
    if (event.kind === 'accepted') {
        if (current || event.taskRevision !== 1) {invalid(`event.${event.eventId}.initial`);}
        const listing = event.listing;
        records.set(event.taskId, {
            taskId: event.taskId,
            taskRevision: 1,
            eventId: event.eventId,
            source: 'received',
            status: 'active',
            issuer: structuredClone(event.issuer),
            assignee: structuredClone(event.assignee),
            reward: listing.reward,
            grade: listing.grade,
            tags: [...listing.tags],
            posture: listing.posture,
            title: listing.title,
            hook: listing.hook,
            objective: listing.objective,
            ...(listing.requirements ? { requirements: listing.requirements } : {}),
            location: listing.location,
            timing: listing.timing,
            risk: listing.risk,
            candidates: [],
            progressSummary: '已接取任务',
            resultSummary: '',
            sourceBoardId: event.boardId,
            sourceListingId: event.listingId,
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
            lastObservedAssistantCount: event.observedAssistantCount,
        });
        return;
    }
    if (event.kind === 'published') {
        if (current || event.taskRevision !== 1) {invalid(`event.${event.eventId}.initial`);}
        records.set(event.taskId, {
            taskId: event.taskId,
            taskRevision: 1,
            eventId: event.eventId,
            source: 'published',
            status: 'recruiting',
            issuer: structuredClone(event.issuer),
            reward: event.reward,
            grade: 'CUSTOM',
            tags: [],
            title: event.title,
            objective: event.objective,
            ...(event.requirements ? { requirements: event.requirements } : {}),
            location: event.location,
            risk: event.risk,
            candidates: [],
            progressSummary: '等待应征者',
            resultSummary: '',
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
            lastObservedAssistantCount: event.observedAssistantCount,
        });
        return;
    }
    if (!current || event.taskRevision !== current.taskRevision + 1) {
        invalid(`event.${event.eventId}.revision`);
    }
    if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
        invalid(`event.${event.eventId}.terminal`);
    }
    if (event.kind === 'candidates-replaced') {
        if (current.source !== 'published' || current.status !== 'recruiting') {
            invalid(`event.${event.eventId}.recruiting`);
        }
        current.candidates = structuredClone(event.candidates);
    } else if (event.kind === 'assigned') {
        if (current.source !== 'published' || current.status !== 'recruiting') {
            invalid(`event.${event.eventId}.assign`);
        }
        const candidate = current.candidates.find(entry => entry.candidateId === event.assignee.partyId);
        if (!candidate || event.assignee.kind !== 'world'
            || event.assignee.displayName !== candidate.name
            || event.assignee.description !== candidate.description
            || event.assignee.pitch !== candidate.pitch
            || event.assignee.capability !== candidate.capability
            || event.assignee.risk !== candidate.risk) {invalid(`event.${event.eventId}.candidate`);}
        current.assignee = structuredClone(event.assignee);
        current.candidates = [];
        current.status = 'active';
        current.progressSummary = `${event.assignee.displayName}已接取任务`;
    } else if (event.kind === 'cancelled') {
        current.status = 'cancelled';
        current.resultSummary = event.resultSummary;
    } else if (event.kind === 'progressed') {
        if (current.status !== 'active') {invalid(`event.${event.eventId}.active`);}
        current.progressSummary = event.progressSummary;
    } else if (event.kind === 'completed') {
        if (current.status !== 'active' || !current.assignee) {invalid(`event.${event.eventId}.complete`);}
        current.status = 'completed';
        current.resultSummary = event.resultSummary;
    } else {
        if (current.status !== 'active') {invalid(`event.${event.eventId}.fail`);}
        current.status = 'failed';
        current.resultSummary = event.resultSummary;
    }
    current.taskRevision = event.taskRevision;
    current.eventId = event.eventId;
    current.updatedAt = event.createdAt;
    current.lastObservedAssistantCount = event.observedAssistantCount;
}

function replayTaskEventRecords(
    events: readonly TaskEvent[],
    visitor?: (event: TaskEvent, record: Readonly<TaskRecord>) => void,
): Map<string, TaskRecord> {
    const records = new Map<string, TaskRecord>();
    for (const event of events) {
        applyTaskEvent(records, event);
        const record = records.get(event.taskId);
        if (!record) {invalid(`event.${event.eventId}.record`);}
        visitor?.(event, record);
    }
    return records;
}

export function visitProjectedTaskEvents(
    events: readonly TaskEvent[],
    visitor: (event: TaskEvent, record: Readonly<TaskRecord>) => void,
): void {
    replayTaskEventRecords(events, visitor);
}

/** Replays immutable facts without retaining references to persisted data. */
export function replayTaskEvents(events: readonly TaskEvent[]): TaskRecord[] {
    const records = replayTaskEventRecords(events);
    return Array.from(records.values(), record => structuredClone(record));
}

/** Pure projection; callers at persistence boundaries validate the domain first. */
export function projectTaskRecords(domain: Readonly<TaskDomainV1>): TaskRecord[] {
    return replayTaskEvents(domain.events);
}

export function projectTaskRecord(domain: Readonly<TaskDomainV1>, taskId: string): TaskRecord | null {
    return projectTaskRecords(domain).find(record => record.taskId === taskId) ?? null;
}

export function calculateElapsedAssistantReplies(record: Readonly<TaskRecord>, observedAssistantCount: number): number {
    return Math.max(0, observedAssistantCount - record.lastObservedAssistantCount);
}
