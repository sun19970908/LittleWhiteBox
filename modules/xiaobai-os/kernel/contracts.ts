export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface XiaobaiOsReferenceV1 {
    formatVersion: 1;
    osId: string;
}

export interface XiaobaiOsChatBindingV1 {
    kind: 'character' | 'group';
    ownerLocator: string;
    chatId: string;
}

export interface XiaobaiOsSidecarV1 {
    formatVersion: 1;
    osId: string;
    binding: XiaobaiOsChatBindingV1;
    revision: number;
    commitId: string;
    partitions: Record<string, unknown>;
}

export interface SidecarRevision {
    osId: string;
    revision: number;
    commitId: string;
}

export interface StorageReplaceInput {
    expected: SidecarRevision | null;
    candidate: XiaobaiOsSidecarV1;
}

export interface StorageFailure {
    code: string;
    message: string;
    retryable: boolean;
}

export type StorageReplaceResult =
    | { status: 'confirmed' }
    | { status: 'failed'; error: StorageFailure }
    | { status: 'unconfirmed'; observed: XiaobaiOsSidecarV1 | null }
    | { status: 'conflict'; observed: XiaobaiOsSidecarV1 };

export interface XiaobaiOsStoragePort {
    read(osId: string, signal?: AbortSignal): Promise<XiaobaiOsSidecarV1 | null>;
    replace(input: StorageReplaceInput, signal?: AbortSignal): Promise<StorageReplaceResult>;
    delete(osId: string, signal?: AbortSignal): Promise<'deleted' | 'missing'>;
}

export type PartitionParseResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: { code: 'partition_invalid'; message: string } };

export interface PartitionRegistration<T> {
    key: string;
    ownerId: string;
    schemaVersion: number;
    parse(value: unknown): PartitionParseResult<T>;
    serialize(value: T): unknown;
    createInitial(): T;
}

export interface CapabilityToken<T> {
    readonly id: string;
    /** Compile-time marker only; capability access is also checked at runtime. */
    readonly __capability?: T;
}

export interface CapabilityTransactionAccess {
    readPartition<T>(registration: PartitionRegistration<T>): T | null;
    replacePartition<T>(registration: PartitionRegistration<T>, value: T): void;
}

export interface PartitionSnapshot<T> {
    identityKey: string;
    osId: string | null;
    envelopeRevision: number | null;
    value: T | null;
}

export interface ScopedTransaction<T> {
    readonly current: T | null;
    currentOrInitial(): T;
    replace(next: T): void;
    useCapability<C>(token: CapabilityToken<C>): C;
}

export interface TransactionOptions {
    signal?: AbortSignal;
    commitGuard?: () => boolean | Promise<boolean>;
    /** Keep a definitely rejected candidate in memory so an explicit retry can submit it unchanged. */
    retainFailedCandidate?: boolean;
}

export interface KernelWriteFailure {
    code: string;
    message: string;
    retryable: boolean;
}

export type ScopedTransactionResult<T, R> =
    | { status: 'unchanged'; result: R }
    | { status: 'confirmed'; result: R; snapshot: PartitionSnapshot<T> }
    | { status: 'failed'; error: KernelWriteFailure }
    | { status: 'unconfirmed'; preparedResult: R; commitId: string }
    | { status: 'conflict'; preparedResult: R };

export interface ScopedChatStore<T> {
    peekCurrent(): PartitionSnapshot<T> | null;
    read(): Promise<PartitionSnapshot<T>>;
    transact<R>(
        command: (context: ScopedTransaction<T>) => R | Promise<R>,
        options?: TransactionOptions,
    ): Promise<ScopedTransactionResult<T, R>>;
    subscribe(listener: (snapshot: PartitionSnapshot<T>) => void): () => void;
}

export type XiaobaiOsFileState = 'loading' | 'ready' | 'saving' | 'unconfirmed' | 'conflict' | 'failed';

export interface XiaobaiOsFileStateChange {
    identityKey: string;
    state: XiaobaiOsFileState;
    error?: KernelWriteFailure;
}

export interface CapturedChatBinding {
    identityKey: string;
    binding: XiaobaiOsChatBindingV1;
    reference: XiaobaiOsReferenceV1 | null;
}

export type ReferenceInstallResult =
    | { status: 'confirmed' }
    | { status: 'failed'; error: KernelWriteFailure }
    | { status: 'unconfirmed'; error: KernelWriteFailure };

export interface ChatReferencePort {
    capture(): CapturedChatBinding | null;
    isCurrent(captured: CapturedChatBinding): boolean | Promise<boolean>;
    install(
        captured: CapturedChatBinding,
        reference: XiaobaiOsReferenceV1,
        signal?: AbortSignal,
    ): Promise<ReferenceInstallResult>;
    recordOrphan?(osId: string, binding: XiaobaiOsChatBindingV1): void | Promise<void>;
    recordReference?(osId: string, binding: XiaobaiOsChatBindingV1): void | Promise<void>;
}

export interface PendingCommitRecoveryResult {
    status: 'none' | 'confirmed' | 'unconfirmed' | 'conflict' | 'failed' | 'adopted';
    error?: KernelWriteFailure;
}

export interface XiaobaiOsFileControls {
    retryPending(): Promise<PendingCommitRecoveryResult>;
    adoptServerState(): Promise<PendingCommitRecoveryResult>;
    getFileState(): XiaobaiOsFileState;
    /** Whether the active chat has a prepared candidate, optionally scoped to its owning partition. */
    hasPendingCommit(partitionKey?: string): boolean;
    subscribeFileState(listener: (change: XiaobaiOsFileStateChange) => void): () => void;
}
