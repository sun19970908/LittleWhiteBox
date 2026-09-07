export const TASK_DOMAIN_SCHEMA_VERSION = 1 as const;
export const TASK_SCHEMA_VERSION = TASK_DOMAIN_SCHEMA_VERSION;

export const TASK_DIRECTIONS = ['禁忌', '接触', '夹缝', '窥秘', '掠夺', '怪癖'] as const;
export const TASK_GRADES = ['E', 'D', 'C', 'B', 'A', 'S', 'EX'] as const;
export const TASK_POSTURES = ['易介入', '中介入', '深介入'] as const;

export const TASK_DIRECTION_REWARD_RANGES = Object.freeze({
    禁忌: [150, 350],
    接触: [40, 80],
    夹缝: [100, 200],
    窥秘: [60, 120],
    掠夺: [80, 150],
    怪癖: [15, 40],
} as const);

export const TASK_GRADE_REWARD_RANGES = Object.freeze({
    E: [5, 15],
    D: [16, 40],
    C: [41, 100],
    B: [101, 250],
    A: [251, 600],
    S: [601, 1_500],
    EX: [1_501, 5_000],
} as const);

export type TaskDirection = typeof TASK_DIRECTIONS[number];
export type TaskBoardGrade = typeof TASK_GRADES[number];
export type TaskGrade = TaskBoardGrade | 'CUSTOM';
export type TaskPosture = typeof TASK_POSTURES[number];
export type TaskTiming = '现在就行' | '任意时候' | `特定时机：${string}`;
export type TaskStatus = 'recruiting' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface TaskDomainV1 {
    schemaVersion: typeof TASK_DOMAIN_SCHEMA_VERSION;
    revision: number;
    board: TaskBoard | null;
    events: TaskEvent[];
}

export interface TaskBoard {
    boardId: string;
    listings: TaskListing[];
    generatedAt: number;
}

export interface TaskListing {
    listingId: string;
    grade: TaskBoardGrade;
    tags: string[];
    posture: TaskPosture;
    title: string;
    hook: string;
    objective: string;
    requirements?: string;
    location: string;
    timing: TaskTiming;
    risk: string;
    reward: number;
}

export interface TaskCandidate {
    candidateId: string;
    name: string;
    description: string;
    pitch: string;
    capability: string;
    risk: string;
}

export type TaskListingDraft = Omit<TaskListing, 'listingId'>;
export type TaskCandidateDraft = Omit<TaskCandidate, 'candidateId'>;

export type TaskParty =
    | { kind: 'player'; displayName: string }
    | {
        kind: 'world';
        partyId: string;
        displayName: string;
        description?: string;
        pitch?: string;
        capability?: string;
        risk?: string;
    };

export interface TaskEventBase {
    kind: string;
    eventId: string;
    actionId: string;
    taskId: string;
    taskRevision: number;
    observedAssistantCount: number;
    createdAt: number;
}

export type TaskEvent =
    | (TaskEventBase & {
        kind: 'accepted';
        boardId: string;
        listingId: string;
        issuer: Extract<TaskParty, { kind: 'world' }>;
        assignee: Extract<TaskParty, { kind: 'player' }>;
        listing: TaskListing;
    })
    | (TaskEventBase & {
        kind: 'published';
        issuer: Extract<TaskParty, { kind: 'player' }>;
        title: string;
        objective: string;
        requirements?: string;
        location: string;
        risk: string;
        reward: number;
    })
    | (TaskEventBase & { kind: 'candidates-replaced'; candidates: TaskCandidate[] })
    | (TaskEventBase & { kind: 'assigned'; assignee: Extract<TaskParty, { kind: 'world' }> })
    | (TaskEventBase & { kind: 'cancelled'; resultSummary: string })
    | (TaskEventBase & { kind: 'progressed'; progressSummary: string })
    | (TaskEventBase & { kind: 'completed'; resultSummary: string })
    | (TaskEventBase & { kind: 'failed'; resultSummary: string });

type TaskEventMetadata = 'eventId' | 'taskRevision' | 'createdAt';
export type TaskEventPayload = TaskEvent extends infer Event
    ? Event extends TaskEvent ? Omit<Event, TaskEventMetadata> : never
    : never;

export interface TaskRecord {
    taskId: string;
    taskRevision: number;
    eventId: string;
    source: 'received' | 'published';
    status: TaskStatus;
    issuer: TaskParty;
    assignee?: TaskParty;
    reward: number;
    grade: TaskGrade;
    tags: string[];
    posture?: TaskPosture;
    title: string;
    hook?: string;
    objective: string;
    requirements?: string;
    location: string;
    timing?: TaskTiming;
    risk: string;
    candidates: TaskCandidate[];
    progressSummary: string;
    resultSummary: string;
    sourceBoardId?: string;
    sourceListingId?: string;
    createdAt: number;
    updatedAt: number;
    lastObservedAssistantCount: number;
}

export interface TaskPublishedForm {
    title: string;
    objective: string;
    requirements?: string;
    location: string;
    risk: string;
    reward: number;
}

export interface TaskCommandEnvironment {
    now: () => number;
    createId: (kind: 'event') => string;
}

export interface TaskCommandResult {
    domain: TaskDomainV1;
    event: TaskEvent | null;
    record: TaskRecord;
    changed: boolean;
}

export interface ReplaceTaskBoardInput {
    expectedBoardId: string | null;
    boardId: string;
    listings: readonly TaskListing[];
    generatedAt: number;
}

export interface AcceptTaskListingInput {
    actionId: string;
    taskId: string;
    boardId: string;
    listingId: string;
    playerDisplayName: string;
    observedAssistantCount: number;
}

export interface PublishTaskInput {
    actionId: string;
    taskId: string;
    form: TaskPublishedForm;
    playerDisplayName: string;
    observedAssistantCount: number;
}

export interface TaskMutationInput {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
    observedAssistantCount: number;
}

export interface ReplaceTaskCandidatesInput extends TaskMutationInput {
    candidates: readonly TaskCandidate[];
}

export interface AssignTaskCandidateInput extends TaskMutationInput {
    candidateId: string;
}

export type CancelTaskInput = TaskMutationInput;

export interface ProgressTaskInput extends TaskMutationInput {
    progressSummary: string;
}

export interface CompleteTaskInput extends TaskMutationInput {
    resultSummary: string;
}

export type FailTaskInput = CompleteTaskInput;

export type TaskErrorCode =
    | 'task_invalid_domain'
    | 'task_unsupported_version'
    | 'task_invalid_input'
    | 'task_action_required'
    | 'task_action_conflict'
    | 'task_id_conflict'
    | 'task_board_conflict'
    | 'task_board_missing'
    | 'task_listing_missing'
    | 'task_listing_already_accepted'
    | 'task_task_missing'
    | 'task_revision_conflict'
    | 'task_event_id_conflict'
    | 'task_task_not_recruiting'
    | 'task_task_not_active'
    | 'task_player_only'
    | 'task_candidate_missing'
    | 'task_terminal';

export class TaskError extends Error {
    readonly code: TaskErrorCode;

    constructor(code: TaskErrorCode, detail = '') {
        super(detail ? `${code}: ${detail}` : code);
        this.name = 'TaskError';
        this.code = code;
    }
}
