import { replayTaskEvents } from './projection.js';
import {
    TASK_DIRECTIONS,
    TASK_DIRECTION_REWARD_RANGES,
    TASK_DOMAIN_SCHEMA_VERSION,
    TASK_GRADE_REWARD_RANGES,
    TASK_GRADES,
    TASK_POSTURES,
    TaskError,
    type TaskBoard,
    type TaskBoardGrade,
    type TaskCandidate,
    type TaskDomainV1,
    type TaskEvent,
    type TaskListing,
    type TaskParty,
    type TaskPosture,
    type TaskPublishedForm,
    type TaskTiming,
} from './types.js';

export const TASK_MAX_ID_LENGTH = 160;
export const TASK_MAX_ACTION_ID_LENGTH = 200;
export const TASK_MAX_PARTY_ID_LENGTH = 180;
export const TASK_MAX_CANDIDATES = 4;
export const TASK_MAX_BOARD_LISTINGS = 6;
export const MAX_TASK_PROGRESS_SUMMARY_LENGTH = 120;
export const MAX_TASK_RESULT_SUMMARY_LENGTH = 2_000;
export const TASK_CANCELLED_SUMMARY = '玩家取消了任务。';

const MAX_DATE_MS = 8_640_000_000_000_000;
const DIRECTIONS = new Set<string>(TASK_DIRECTIONS);
const GRADES = new Set<string>(TASK_GRADES);
const POSTURES = new Set<string>(TASK_POSTURES);

function invalid(detail: string): never {
    throw new TaskError('task_invalid_domain', detail);
}

function badInput(detail: string): never {
    throw new TaskError('task_invalid_input', detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, detail: string, domain = false): Record<string, unknown> {
    if (!isRecord(value)) {(domain ? invalid : badInput)(`${detail}.shape`);}
    const record = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) {(domain ? invalid : badInput)(`${detail}.prototype`);}
    return record;
}

function requireKeys(
    value: Record<string, unknown>,
    required: readonly string[],
    optional: readonly string[],
    detail: string,
    domain = false,
): void {
    const allowed = new Set([...required, ...optional]);
    const fail = domain ? invalid : badInput;
    for (const key of Object.keys(value)) {if (!allowed.has(key)) {fail(`${detail}.${key}`);}}
    for (const key of required) {if (!Object.hasOwn(value, key)) {fail(`${detail}.${key}`);}}
}

export function requireTaskCommandKeys(
    value: unknown,
    required: readonly string[],
    optional: readonly string[] = [],
): Record<string, unknown> {
    const record = requireRecord(value, 'command');
    requireKeys(record, required, optional, 'command');
    return record;
}

function normalizeBaseText(value: unknown): string {
    if (typeof value !== 'string') {badInput('text.type');}
    return value.normalize('NFKC')
        .replace(/\r\n?|\u2028|\u2029/gu, '\n')
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/gu, ' ')
        .trim();
}

export function normalizeTaskText(
    value: unknown,
    maxLength: number,
    options: { required?: boolean; singleLine?: boolean; field?: string } = {},
): string {
    let text = normalizeBaseText(value);
    if (options.singleLine) {text = text.replace(/\s+/gu, ' ').trim();}
    if ((options.required && !text) || Array.from(text).length > maxLength) {
        badInput(options.field ?? 'text');
    }
    return text;
}

export function normalizeTaskIdentity(value: unknown, maxLength = TASK_MAX_ID_LENGTH): string {
    const id = normalizeTaskText(value, maxLength, { required: true, singleLine: true, field: 'id' });
    if (/\n/u.test(id)) {badInput('id');}
    return id;
}

export function normalizeTaskActionId(value: unknown): string {
    try {return normalizeTaskIdentity(value, TASK_MAX_ACTION_ID_LENGTH);} catch {
        throw new TaskError('task_action_required');
    }
}

export function normalizeTaskTimestamp(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > MAX_DATE_MS) {badInput('timestamp');}
    return Number(value);
}

export function normalizeObservedAssistantCount(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {badInput('observedAssistantCount');}
    return Number(value);
}

function normalizeReward(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) <= 0) {badInput('reward');}
    return Number(value);
}

export function normalizeTaskDisplayName(value: unknown): string {
    return normalizeTaskText(value, 120, { required: true, singleLine: true, field: 'displayName' });
}

/** Canonicalizes the user-facing timing vocabulary shared by generation and persistence. */
export function normalizeTaskTiming(value: unknown): TaskTiming {
    const timing = normalizeTaskText(value, 40, {
        required: true,
        singleLine: true,
        field: 'listing.timing',
    });
    if (timing === '现在就行' || timing === '任意时候') {return timing;}
    const specific = /^特定时机\s*[:：]\s*(.+)$/u.exec(timing)?.[1]?.trim();
    if (!specific) {badInput('listing.timing');}
    return `特定时机：${specific}`;
}

function optionalText(record: Record<string, unknown>, key: string, maxLength: number, singleLine = false): string | undefined {
    if (!Object.hasOwn(record, key)) {return undefined;}
    const text = normalizeTaskText(record[key], maxLength, { singleLine, field: key });
    return text || undefined;
}

function normalizeTaskListingFacts(value: unknown): TaskListing {
    const record = requireRecord(value, 'listing');
    requireKeys(record, [
        'listingId', 'grade', 'tags', 'posture', 'title', 'hook', 'objective', 'location', 'timing', 'risk', 'reward',
    ], ['requirements'], 'listing');
    if (!Array.isArray(record.tags) || record.tags.length < 1 || record.tags.length > 4) {badInput('listing.tags');}
    const tags = record.tags.map((tag, index) => normalizeTaskText(tag, 16, {
        required: true, singleLine: true, field: `listing.tags.${index}`,
    }));
    if (new Set(tags).size !== tags.length || !DIRECTIONS.has(tags[0] as string)) {badInput('listing.tags');}
    const grade = normalizeTaskText(record.grade, 2, { required: true, singleLine: true, field: 'listing.grade' }).toUpperCase();
    if (!GRADES.has(grade)) {badInput('listing.grade');}
    const posture = normalizeTaskText(record.posture, 4, {
        required: true, singleLine: true, field: 'listing.posture',
    });
    if (!POSTURES.has(posture)) {badInput('listing.posture');}
    const timing = normalizeTaskTiming(record.timing);
    const reward = normalizeReward(record.reward);
    const requirements = optionalText(record, 'requirements', 64, true);
    return {
        listingId: normalizeTaskIdentity(record.listingId),
        grade: grade as TaskBoardGrade,
        tags,
        posture: posture as TaskPosture,
        title: normalizeTaskText(record.title, 12, { required: true, singleLine: true, field: 'listing.title' }),
        hook: normalizeTaskText(record.hook, 120, { required: true, singleLine: true, field: 'listing.hook' }),
        objective: normalizeTaskText(record.objective, 48, { required: true, singleLine: true, field: 'listing.objective' }),
        ...(requirements ? { requirements } : {}),
        location: normalizeTaskText(record.location, 48, { required: true, singleLine: true, field: 'listing.location' }),
        timing: timing as TaskTiming,
        risk: normalizeTaskText(record.risk, 64, { required: true, singleLine: true, field: 'listing.risk' }),
        reward,
    };
}

/** Applies the current board-generation policy to one canonical V1 listing. */
export function normalizeTaskBoardListing(value: unknown): TaskListing {
    const listing = normalizeTaskListingFacts(value);
    if (listing.posture === '易介入' && listing.timing.startsWith('特定时机：')) {badInput('listing.timing');}
    const directionRange = TASK_DIRECTION_REWARD_RANGES[
        listing.tags[0] as keyof typeof TASK_DIRECTION_REWARD_RANGES
    ];
    const gradeRange = TASK_GRADE_REWARD_RANGES[listing.grade];
    if (listing.reward < directionRange[0] || listing.reward > directionRange[1]
        || listing.reward < gradeRange[0] || listing.reward > gradeRange[1]) {badInput('listing.reward');}
    return listing;
}

function normalizeTaskListingCollection(
    value: unknown,
    normalize: (entry: unknown) => TaskListing,
    enforceCurrentOrder: boolean,
): TaskListing[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > TASK_MAX_BOARD_LISTINGS) {badInput('listings');}
    const listings = value.map(normalize);
    const ids = new Set<string>();
    let previousDirection = -1;
    for (const listing of listings) {
        const direction = TASK_DIRECTIONS.indexOf(listing.tags[0] as typeof TASK_DIRECTIONS[number]);
        if (ids.has(listing.listingId)) {badInput('listings.ids');}
        if (enforceCurrentOrder && direction <= previousDirection) {badInput('listings.order');}
        ids.add(listing.listingId);
        previousDirection = direction;
    }
    return listings;
}

export function normalizeTaskBoardListings(value: unknown): TaskListing[] {
    return normalizeTaskListingCollection(value, normalizeTaskBoardListing, true);
}

function normalizePersistedTaskListings(value: unknown): TaskListing[] {
    return normalizeTaskListingCollection(value, normalizeTaskListingFacts, false);
}

export function normalizeTaskCandidate(value: unknown): TaskCandidate {
    const record = requireRecord(value, 'candidate');
    requireKeys(record, ['candidateId', 'name', 'description', 'pitch', 'capability', 'risk'], [], 'candidate');
    return {
        candidateId: normalizeTaskIdentity(record.candidateId),
        name: normalizeTaskText(record.name, 120, { required: true, singleLine: true, field: 'candidate.name' }),
        description: normalizeTaskText(record.description, 2_000, { required: true, field: 'candidate.description' }),
        pitch: normalizeTaskText(record.pitch, 2_000, { required: true, field: 'candidate.pitch' }),
        capability: normalizeTaskText(record.capability, 2_000, { required: true, field: 'candidate.capability' }),
        risk: normalizeTaskText(record.risk, 2_000, { required: true, field: 'candidate.risk' }),
    };
}

export function normalizeTaskCandidates(value: unknown): TaskCandidate[] {
    if (!Array.isArray(value) || value.length > TASK_MAX_CANDIDATES) {badInput('candidates');}
    const candidates = value.map(normalizeTaskCandidate);
    if (new Set(candidates.map(candidate => candidate.candidateId)).size !== candidates.length) {badInput('candidates.ids');}
    const names = candidates.map(candidate => candidate.name.toLowerCase());
    if (new Set(names).size !== names.length) {badInput('candidates.names');}
    return candidates;
}

export function normalizeTaskPublishedForm(value: unknown): TaskPublishedForm {
    const record = requireRecord(value, 'form');
    requireKeys(record, ['title', 'objective', 'location', 'risk', 'reward'], ['requirements'], 'form');
    const requirements = optionalText(record, 'requirements', 8_000);
    return {
        title: normalizeTaskText(record.title, 120, { required: true, singleLine: true, field: 'form.title' }),
        objective: normalizeTaskText(record.objective, 8_000, { required: true, field: 'form.objective' }),
        ...(requirements ? { requirements } : {}),
        location: normalizeTaskText(record.location, 600, { required: true, singleLine: true, field: 'form.location' }),
        risk: normalizeTaskText(record.risk, 2_000, { field: 'form.risk' }),
        reward: normalizeReward(record.reward),
    };
}

export function normalizeTaskProgressSummary(value: unknown): string {
    return normalizeTaskText(value, MAX_TASK_PROGRESS_SUMMARY_LENGTH, { required: true, field: 'progressSummary' });
}

export function normalizeTaskResultSummary(value: unknown): string {
    return normalizeTaskText(value, MAX_TASK_RESULT_SUMMARY_LENGTH, { required: true, field: 'resultSummary' });
}

export function normalizeTaskCas(revision: unknown, eventId: unknown): { expectedTaskRevision: number; expectedEventId: string } {
    if (!Number.isSafeInteger(revision) || Number(revision) < 1) {badInput('expectedTaskRevision');}
    return { expectedTaskRevision: Number(revision), expectedEventId: normalizeTaskIdentity(eventId) };
}

export function sameTaskValue(left: unknown, right: unknown): boolean {
    const canonical = (value: unknown): unknown => {
        if (Array.isArray(value)) {return value.map(canonical);}
        if (!isRecord(value)) {return value;}
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    };
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function canonicalDomainValue<T>(value: unknown, normalize: (entry: unknown) => T, detail: string): T {
    try {
        const normalized = normalize(value);
        if (!sameTaskValue(value, normalized)) {invalid(`${detail}.canonical`);}
        return normalized;
    } catch (error) {
        if (error instanceof TaskError && error.code === 'task_invalid_domain') {throw error;}
        return invalid(detail);
    }
}

function canonicalText(value: unknown, max: number, detail: string, required = true, singleLine = false): string {
    try {
        const normalized = normalizeTaskText(value, max, { required, singleLine, field: detail });
        if (value !== normalized) {invalid(`${detail}.canonical`);}
        return normalized;
    } catch (error) {
        if (error instanceof TaskError && error.code === 'task_invalid_domain') {throw error;}
        return invalid(detail);
    }
}

function canonicalId(value: unknown, detail: string, max = TASK_MAX_ID_LENGTH): string {
    try {
        const normalized = normalizeTaskIdentity(value, max);
        if (value !== normalized) {invalid(`${detail}.canonical`);}
        return normalized;
    } catch {return invalid(detail);}
}

function canonicalInteger(value: unknown, minimum: number, detail: string): number {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) {return invalid(detail);}
    return Number(value);
}

function validateParty(value: unknown, detail: string): TaskParty {
    const party = requireRecord(value, detail, true);
    if (party.kind === 'player') {
        requireKeys(party, ['kind', 'displayName'], [], detail, true);
        return { kind: 'player', displayName: canonicalText(party.displayName, 120, `${detail}.displayName`, true, true) };
    }
    if (party.kind !== 'world') {return invalid(`${detail}.kind`);}
    requireKeys(party, ['kind', 'partyId', 'displayName'], ['description', 'pitch', 'capability', 'risk'], detail, true);
    const result: Extract<TaskParty, { kind: 'world' }> = {
        kind: 'world',
        partyId: canonicalId(party.partyId, `${detail}.partyId`, TASK_MAX_PARTY_ID_LENGTH),
        displayName: canonicalText(party.displayName, 120, `${detail}.displayName`, true, true),
    };
    for (const [key, max] of [['description', 2_000], ['pitch', 2_000], ['capability', 2_000], ['risk', 2_000]] as const) {
        if (Object.hasOwn(party, key)) {result[key] = canonicalText(party[key], max, `${detail}.${key}`);}
    }
    return result;
}

function validateEvent(value: unknown, index: number): TaskEvent {
    const detail = `events.${index}`;
    const event = requireRecord(value, detail, true);
    const base = ['kind', 'eventId', 'actionId', 'taskId', 'taskRevision', 'observedAssistantCount', 'createdAt'];
    const variants: Readonly<Record<string, readonly string[]>> = {
        accepted: ['boardId', 'listingId', 'issuer', 'assignee', 'listing'],
        published: ['issuer', 'title', 'objective', 'location', 'risk', 'reward'],
        'candidates-replaced': ['candidates'], assigned: ['assignee'], cancelled: ['resultSummary'],
        progressed: ['progressSummary'], completed: ['resultSummary'], failed: ['resultSummary'],
    };
    if (typeof event.kind !== 'string' || !Object.hasOwn(variants, event.kind)) {return invalid(`${detail}.kind`);}
    const optional = event.kind === 'published' ? ['requirements'] : [];
    requireKeys(event, [...base, ...variants[event.kind] as string[]], optional, detail, true);
    const common = {
        kind: event.kind,
        eventId: canonicalId(event.eventId, `${detail}.eventId`),
        actionId: canonicalId(event.actionId, `${detail}.actionId`, TASK_MAX_ACTION_ID_LENGTH),
        taskId: canonicalId(event.taskId, `${detail}.taskId`),
        taskRevision: canonicalInteger(event.taskRevision, 1, `${detail}.taskRevision`),
        observedAssistantCount: canonicalInteger(event.observedAssistantCount, 0, `${detail}.observedAssistantCount`),
        createdAt: canonicalInteger(event.createdAt, 0, `${detail}.createdAt`),
    };
    if (common.createdAt > MAX_DATE_MS) {return invalid(`${detail}.createdAt`);}
    if (event.kind === 'accepted') {
        return { ...common, kind: 'accepted', boardId: canonicalId(event.boardId, `${detail}.boardId`),
            listingId: canonicalId(event.listingId, `${detail}.listingId`),
            issuer: validateParty(event.issuer, `${detail}.issuer`) as Extract<TaskParty, { kind: 'world' }>,
            assignee: validateParty(event.assignee, `${detail}.assignee`) as Extract<TaskParty, { kind: 'player' }>,
            listing: canonicalDomainValue(event.listing, normalizeTaskListingFacts, `${detail}.listing`) };
    }
    if (event.kind === 'published') {
        const form = canonicalDomainValue({ title: event.title, objective: event.objective,
            ...(Object.hasOwn(event, 'requirements') ? { requirements: event.requirements } : {}),
            location: event.location, risk: event.risk, reward: event.reward }, normalizeTaskPublishedForm, `${detail}.form`);
        return { ...common, kind: 'published', issuer: validateParty(event.issuer, `${detail}.issuer`) as Extract<TaskParty, { kind: 'player' }>, ...form };
    }
    if (event.kind === 'candidates-replaced') {
        return { ...common, kind: event.kind, candidates: canonicalDomainValue(event.candidates, normalizeTaskCandidates, `${detail}.candidates`) };
    }
    if (event.kind === 'assigned') {
        return { ...common, kind: event.kind, assignee: validateParty(event.assignee, `${detail}.assignee`) as Extract<TaskParty, { kind: 'world' }> };
    }
    if (event.kind === 'progressed') {
        return { ...common, kind: event.kind, progressSummary: canonicalText(event.progressSummary, 120, `${detail}.progressSummary`) };
    }
    const resultSummary = canonicalText(event.resultSummary, 2_000, `${detail}.resultSummary`);
    return { ...common, kind: event.kind, resultSummary } as TaskEvent;
}

function validateBoard(value: unknown): TaskBoard | null {
    if (value === null) {return null;}
    const board = requireRecord(value, 'board', true);
    requireKeys(board, ['boardId', 'listings', 'generatedAt'], [], 'board', true);
    return {
        boardId: canonicalId(board.boardId, 'board.boardId'),
        listings: canonicalDomainValue(board.listings, normalizePersistedTaskListings, 'board.listings'),
        generatedAt: (() => {
            const timestamp = canonicalInteger(board.generatedAt, 0, 'board.generatedAt');
            return timestamp <= MAX_DATE_MS ? timestamp : invalid('board.generatedAt');
        })(),
    };
}

function validateIdentities(board: TaskBoard | null, events: readonly TaskEvent[]): void {
    const kinds = new Map<string, string>();
    const listingBoard = new Map<string, string>();
    const listingFacts = new Map<string, TaskListing>();
    const candidateDeclarations = new Set<string>();
    const tasks = new Set<string>();
    const acceptedListings = new Set<string>();
    const declare = (id: string, kind: string): void => {
        if (kinds.has(id)) {invalid(`identity.${id}`);}
        kinds.set(id, kind);
    };
    const reference = (id: string, kind: string): void => {
        const existing = kinds.get(id);
        if (existing && existing !== kind) {invalid(`identity.${id}`);}
        if (!existing) {kinds.set(id, kind);}
    };
    if (board) {
        declare(board.boardId, 'board');
        for (const listing of board.listings) {
            declare(listing.listingId, 'listing');
            listingBoard.set(listing.listingId, board.boardId);
            listingFacts.set(listing.listingId, listing);
        }
    }
    for (const event of events) {
        declare(event.eventId, 'event');
        declare(event.actionId, 'action');
        if (!tasks.has(event.taskId)) {declare(event.taskId, 'task'); tasks.add(event.taskId);}
        if (event.kind === 'accepted') {
            reference(event.boardId, 'board');
            reference(event.listingId, 'listing');
            const sourceBoard = listingBoard.get(event.listingId);
            if (sourceBoard && sourceBoard !== event.boardId) {invalid(`listing.${event.listingId}.board`);}
            const facts = listingFacts.get(event.listingId);
            if (facts && !sameTaskValue(facts, event.listing)) {invalid(`listing.${event.listingId}.facts`);}
            listingBoard.set(event.listingId, event.boardId);
            listingFacts.set(event.listingId, event.listing);
            const pair = `${event.boardId}\u0000${event.listingId}`;
            if (acceptedListings.has(pair)) {invalid(`listing.${event.listingId}.accepted`);}
            acceptedListings.add(pair);
            const expectedIssuer = { kind: 'world', partyId: `board:${event.taskId}`, displayName: '任务终端托管',
                description: '匿名委托报酬的内部结算来源' };
            if (!sameTaskValue(event.issuer, expectedIssuer) || event.listing.listingId !== event.listingId
                || event.assignee.kind !== 'player') {invalid(`event.${event.eventId}.accepted`);}
            declare(event.issuer.partyId, 'party');
        } else if (event.kind === 'published') {
            if (event.issuer.kind !== 'player') {invalid(`event.${event.eventId}.issuer`);}
        } else if (event.kind === 'candidates-replaced') {
            for (const candidate of event.candidates) {
                if (candidateDeclarations.has(candidate.candidateId)) {invalid(`candidate.${candidate.candidateId}`);}
                declare(candidate.candidateId, 'candidate');
                candidateDeclarations.add(candidate.candidateId);
            }
        }
    }
}

/** Validates exact V1 shape, identity ownership and every legal transition by replay. */
export function validateTaskDomain(value: unknown): asserts value is TaskDomainV1 {
    const domain = requireRecord(value, 'domain', true);
    if (domain.schemaVersion !== TASK_DOMAIN_SCHEMA_VERSION) {
        throw new TaskError('task_unsupported_version');
    }
    requireKeys(domain, ['schemaVersion', 'revision', 'board', 'events'], [], 'domain', true);
    const revision = canonicalInteger(domain.revision, 0, 'domain.revision');
    const board = validateBoard(domain.board);
    if (!Array.isArray(domain.events)) {invalid('domain.events');}
    const events = domain.events.map(validateEvent);
    validateIdentities(board, events);
    replayTaskEvents(events);
    if (events.some(event => event.kind === 'accepted') && !board) {invalid('domain.board');}

    // A maintenance mutation can retain one event for each task without a persisted batch id.
    // The strongest provable lower bound is every local event plus the busiest task's
    // maintenance chain. A current board proves at least one board replacement.
    const maintenanceCounts = new Map<string, number>();
    let localEventCount = 0;
    for (const event of events) {
        if (event.kind === 'progressed' || event.kind === 'completed' || event.kind === 'failed') {
            maintenanceCounts.set(event.taskId, (maintenanceCounts.get(event.taskId) ?? 0) + 1);
        } else {
            localEventCount += 1;
        }
    }
    const minimumRevision = localEventCount
        + Math.max(0, ...maintenanceCounts.values())
        + (board ? 1 : 0);
    if (revision < minimumRevision || (revision === 0) !== (!board && events.length === 0)) {
        invalid('domain.revision');
    }
}

export function parseTaskDomain(value: unknown): TaskDomainV1 {
    validateTaskDomain(value);
    return structuredClone(value);
}

export function createEmptyTaskDomain(): TaskDomainV1 {
    return { schemaVersion: TASK_DOMAIN_SCHEMA_VERSION, revision: 0, board: null, events: [] };
}

export const createEmptyTaskState = createEmptyTaskDomain;

export function collectTaskIdentityIds(domain: Readonly<TaskDomainV1>): Set<string> {
    const ids = new Set<string>();
    if (domain.board) {
        ids.add(domain.board.boardId);
        for (const listing of domain.board.listings) {ids.add(listing.listingId);}
    }
    for (const event of domain.events) {
        ids.add(event.eventId); ids.add(event.actionId); ids.add(event.taskId);
        if (event.kind === 'accepted') {
            ids.add(event.boardId); ids.add(event.listingId); ids.add(event.issuer.partyId);
        } else if (event.kind === 'candidates-replaced') {
            for (const candidate of event.candidates) {ids.add(candidate.candidateId);}
        } else if (event.kind === 'assigned') {ids.add(event.assignee.partyId);}
    }
    return ids;
}

export function assertFreshTaskIdentities(domain: Readonly<TaskDomainV1>, ids: readonly string[]): void {
    const occupied = collectTaskIdentityIds(domain);
    const pending = new Set<string>();
    for (const id of ids) {
        if (occupied.has(id) || pending.has(id)) {throw new TaskError('task_id_conflict', id);}
        pending.add(id);
    }
}
