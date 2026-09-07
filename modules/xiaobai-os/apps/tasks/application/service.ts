import {
    ECONOMY_TRANSACTION_CAPABILITY,
    type EconomyReadCapability,
    type EconomyTransactionCapability,
} from '../../../capabilities/economy/index.js';
import type {
    PendingCommitRecoveryResult,
    ScopedChatStore,
    XiaobaiOsFileControls,
    XiaobaiOsFileState,
} from '../../../kernel/contracts.js';
import { collectTaskIdentityIds } from '../../../domains/tasks/invariants.js';
import { projectTaskRecords } from '../../../domains/tasks/projection.js';
import type {
    TaskCandidateDraft,
    TaskDomainV1,
    TaskListingDraft,
    TaskPublishedForm,
    TaskRecord,
} from '../../../domains/tasks/types.js';
import { createTaskIdFactory, type TaskIdFactory } from './ids.js';
import { createTaskLocalActions } from './local-actions.js';
import { createTaskMaintenanceCommit } from './maintenance-commit.js';
import { validateTaskEconomyConsistency } from './economy-protocol.js';

export type CommitGuard = () => boolean | Promise<boolean>;

export interface TasksServiceView {
    domain: TaskDomainV1 | null;
    records: TaskRecord[];
    playerBalance: number;
    writeState: XiaobaiOsFileState;
    pendingSave: boolean;
}

export interface TasksActionResult {
    changed: boolean;
    record?: TaskRecord;
    view: TasksServiceView;
}

export interface AcceptListingRequest {
    actionId: string;
    boardId: string;
    listingId: string;
}

export interface PublishRequest {
    actionId: string;
    form: TaskPublishedForm;
}

export interface ReplaceBoardRequest {
    expectedBoardId: string | null;
    listings: readonly TaskListingDraft[];
    generatedAt: number;
}

export interface ReplaceCandidatesRequest {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
    candidates: readonly TaskCandidateDraft[];
    observedAssistantCount: number;
}

export interface AssignCandidateRequest {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
    candidateId: string;
}

export interface CancelTaskRequest {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
}

interface TaskMaintenanceCommandBase {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
}

export type TaskMaintenanceCommand =
    | (TaskMaintenanceCommandBase & { kind: 'progress'; progressSummary: string })
    | (TaskMaintenanceCommandBase & { kind: 'complete'; resultSummary: string })
    | (TaskMaintenanceCommandBase & { kind: 'fail'; resultSummary: string });

export interface MaintenanceCommitRequest {
    commands: readonly TaskMaintenanceCommand[];
    observedAssistantCount: number;
}

export interface TasksService {
    readCurrent: () => TasksServiceView;
    refreshCurrent: () => Promise<TasksServiceView>;
    createActionId: () => string;
    acceptListing: (input: AcceptListingRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    publish: (input: PublishRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    replaceCandidates: (input: ReplaceCandidatesRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    assignCandidate: (input: AssignCandidateRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    cancel: (input: CancelTaskRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    replaceBoard: (input: ReplaceBoardRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    commitMaintenance: (input: MaintenanceCommitRequest, guard: CommitGuard) => Promise<TasksActionResult>;
    getWriteState: () => XiaobaiOsFileState;
    confirmPending: () => Promise<PendingCommitRecoveryResult>;
    adoptServerState: () => Promise<PendingCommitRecoveryResult>;
    subscribe: (listener: () => void) => () => void;
    dispose: () => void;
}

export interface TasksServiceDependencies {
    now?: () => number;
    ids?: TaskIdFactory;
    getPlayerDisplayName?: () => string;
    getObservedAssistantCount?: () => number;
}

export interface PreparedTaskAction {
    domain: TaskDomainV1;
    changed: boolean;
    record?: TaskRecord;
}

export interface TaskApplicationContext {
    now: () => number;
    ids: TaskIdFactory;
    getPlayerDisplayName: () => string;
    getObservedAssistantCount: () => number;
    execute(
        guard: CommitGuard,
        mutate: (domain: TaskDomainV1, economy: EconomyTransactionCapability) => PreparedTaskAction,
    ): Promise<TasksActionResult>;
}

function transactionError(result: {
    status: 'failed' | 'unconfirmed' | 'conflict';
    error?: { code: string; message: string; retryable: boolean };
}): Error {
    const commitRejected = result.error?.code === 'commit_guard_rejected';
    return Object.assign(new Error(commitRejected
        ? 'tasks_commit_guard_failed'
        : result.error?.message || `tasks_save_${result.status}`), {
        code: commitRejected ? 'tasks_commit_guard_failed' : result.error?.code ?? `storage_${result.status}`,
        retryable: result.error?.retryable ?? true,
        uncertain: result.status === 'unconfirmed',
        saveStatus: result.status,
    });
}

async function assertCommitGuard(guard: CommitGuard): Promise<void> {
    if (typeof guard !== 'function' || await guard() !== true) {
        throw Object.assign(new Error('tasks_commit_guard_failed'), { code: 'tasks_commit_guard_failed' });
    }
}

export function createTasksService(
    store: ScopedChatStore<TaskDomainV1>,
    files: XiaobaiOsFileControls,
    economy: EconomyReadCapability,
    {
        now = Date.now,
        ids = createTaskIdFactory({ now }),
        getPlayerDisplayName = () => '玩家',
        getObservedAssistantCount = () => 0,
    }: TasksServiceDependencies = {},
): TasksService {
    const listeners = new Set<() => void>();
    let publishScheduled = false;
    const schedulePublish = (): void => {
        if (publishScheduled) {return;}
        publishScheduled = true;
        queueMicrotask(() => {
            publishScheduled = false;
            for (const listener of listeners) {
                try { listener(); } catch (error) {
                    console.error('[LittleWhiteBox] Tasks state listener failed', error);
                }
            }
        });
    };
    const unsubscribeStore = store.subscribe(schedulePublish);
    const unsubscribeEconomy = economy.subscribe(schedulePublish);
    const unsubscribeFiles = files.subscribeFileState(schedulePublish);

    const currentDomain = (): TaskDomainV1 | null => store.peekCurrent()?.value ?? null;

    function buildView(domain = currentDomain()): TasksServiceView {
        return {
            domain: domain ? structuredClone(domain) : null,
            records: domain ? projectTaskRecords(domain) : [],
            playerBalance: economy.getPlayerBalance(),
            writeState: files.getFileState(),
            pendingSave: files.hasPendingCommit(),
        };
    }

    async function refreshCurrent(): Promise<TasksServiceView> {
        await economy.refresh();
        const result = await store.transact(transaction => {
            const domain = transaction.current;
            validateTaskEconomyConsistency(
                domain ?? transaction.currentOrInitial(),
                transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY),
            );
            return domain;
        });
        if (result.status === 'failed' || result.status === 'unconfirmed' || result.status === 'conflict') {
            throw transactionError(result);
        }
        if (result.status === 'confirmed') {throw new Error('tasks_refresh_wrote_state');}
        return buildView(result.result);
    }

    async function execute(
        guard: CommitGuard,
        mutate: (domain: TaskDomainV1, transactionEconomy: EconomyTransactionCapability) => PreparedTaskAction,
    ): Promise<TasksActionResult> {
        await assertCommitGuard(guard);
        const result = await store.transact(transaction => {
            const domain = transaction.currentOrInitial();
            const transactionEconomy = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
            validateTaskEconomyConsistency(domain, transactionEconomy);
            const prepared = mutate(domain, transactionEconomy);
            validateTaskEconomyConsistency(prepared.domain, transactionEconomy);
            if (prepared.changed) { transaction.replace(prepared.domain); }
            return prepared;
        }, {
            commitGuard: async () => {
                await assertCommitGuard(guard);
                return true;
            },
        });
        if (result.status === 'failed' || result.status === 'unconfirmed' || result.status === 'conflict') {
            throw transactionError(result);
        }
        const prepared = result.result;
        return {
            changed: prepared.changed,
            ...(prepared.record ? { record: structuredClone(prepared.record) } : {}),
            view: buildView(result.status === 'confirmed' ? result.snapshot.value : prepared.domain),
        };
    }

    const context: TaskApplicationContext = {
        now,
        ids,
        getPlayerDisplayName,
        getObservedAssistantCount,
        execute,
    };
    const localActions = createTaskLocalActions(context);

    return Object.freeze({
        readCurrent: () => buildView(),
        refreshCurrent,
        createActionId() {
            const domain = currentDomain();
            return ids.create('action', domain ? collectTaskIdentityIds(domain) : new Set());
        },
        ...localActions,
        commitMaintenance: createTaskMaintenanceCommit(context),
        getWriteState: () => files.getFileState(),
        confirmPending: () => files.retryPending(),
        adoptServerState: () => files.adoptServerState(),
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            unsubscribeStore();
            unsubscribeEconomy();
            unsubscribeFiles();
            listeners.clear();
        },
    });
}
