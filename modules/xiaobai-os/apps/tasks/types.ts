import type { XiaobaiOsFileState } from '../../kernel/contracts.js';
import type { TaskBoard, TaskEvent, TaskPublishedForm, TaskRecord } from '../../domains/tasks/types.js';

export interface TasksSettings {
    autoMaintenance: boolean;
}

export type TasksClientStatus = 'ready' | 'loading' | 'saving' | 'unconfirmed' | 'conflict' | 'blocked';

export interface TasksGenerationState {
    state: 'idle' | 'running';
    kind: 'board' | 'candidates' | null;
    taskId: string | null;
    message: string;
}

export interface TaskBoardPresentation extends Omit<TaskBoard, 'listings'> {
    listings: Array<TaskBoard['listings'][number] & { accepted: boolean }>;
}

export interface TaskHistoryPage {
    items: TaskRecord[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface OwnedCommission {
    scopeId: string;
    sourceLabel: string;
    task: TaskRecord;
}

export interface TasksPresentation {
    chatIdentity: string;
    status: TasksClientStatus;
    message: string;
    writeState: XiaobaiOsFileState;
    settings: TasksSettings;
    playerBalance: number;
    currentScopeId: string | null;
    commissions: OwnedCommission[];
    generationActive: boolean;
    generation: TasksGenerationState;
    board: TaskBoardPresentation | null;
    active: TaskRecord[];
    recruiting: TaskRecord[];
    history: TaskHistoryPage;
    maintenance: {
        state: 'idle' | 'running';
        message: string;
    };
}

export interface TaskTimelineItem {
    eventId: string;
    kind: TaskEvent['kind'];
    taskRevision: number;
    createdAt: number;
    summary: string;
}

export interface TaskDetailPresentation {
    task: TaskRecord;
    timeline: TaskTimelineItem[];
    originScopeId?: string;
    sourceLabel?: string;
}

export type { TaskEvent, TaskPublishedForm, TaskRecord };
