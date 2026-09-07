import type {
    CapturedChatBinding,
    ChatReferencePort,
    KernelWriteFailure,
    SidecarRevision,
    XiaobaiOsChatBindingV1,
    XiaobaiOsSidecarV1,
    XiaobaiOsStoragePort,
} from '../kernel/contracts.js';
import { cloneJsonValue, sidecarRevision } from '../kernel/envelope.js';
import {
    readXiaobaiOsReference,
    type ChatMetadataAdapter,
    type ChatMetadataCapture,
} from './chat-reference.js';
import type { SidecarIndex } from './sidecar-index.js';

export type ChatBindingResolution =
    | { status: 'empty' }
    | { status: 'ready'; envelope: XiaobaiOsSidecarV1; created: boolean }
    | { status: 'unconfirmed'; osId: string }
    | { status: 'conflict'; error: KernelWriteFailure }
    | { status: 'failed'; error: KernelWriteFailure };

export interface ChatBindingManagerOptions {
    metadata: ChatMetadataAdapter;
    references: ChatReferencePort;
    storage: XiaobaiOsStoragePort;
    index: SidecarIndex;
    createId?: () => string;
    prepareClonedPartitions?: (capture: ChatMetadataCapture, source: XiaobaiOsChatBindingV1, partitions: Record<string, unknown>) => void;
}

export interface ChatBindingManager {
    resolveCurrent(): Promise<ChatBindingResolution>;
    retryPendingCurrent(): Promise<ChatBindingResolution>;
    handleChatDeleted(chatId: string, ownerLocator?: string): Promise<'deleted' | 'retained'>;
    handleCharacterRenamed(oldOwnerLocator: string, newOwnerLocator: string): Promise<void>;
}

interface PendingNewSidecar {
    capture: ChatMetadataCapture;
    referenceCapture: CapturedChatBinding;
    candidate: XiaobaiOsSidecarV1;
    stage: 'replace' | 'reference';
    referenceAttempted: boolean;
}

function failure(code: string, message: string, retryable: boolean): KernelWriteFailure {
    return { code, message, retryable };
}

function randomId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, '_');
    }
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function captureForReference(capture: ChatMetadataCapture): CapturedChatBinding {
    return {
        identityKey: capture.identityKey,
        binding: { ...capture.binding },
        reference: readXiaobaiOsReference(capture.metadata),
    };
}

function sameBinding(left: XiaobaiOsChatBindingV1, right: XiaobaiOsChatBindingV1): boolean {
    return left.kind === right.kind && left.ownerLocator === right.ownerLocator && left.chatId === right.chatId;
}

function expectedRevision(envelope: XiaobaiOsSidecarV1): SidecarRevision {
    return sidecarRevision(envelope);
}

export function createChatBindingManager(options: ChatBindingManagerOptions): ChatBindingManager {
    const { metadata, references, storage, index } = options;
    const createId = options.createId ?? randomId;
    const pending = new Map<string, PendingNewSidecar>();

    function rememberBestEffort(osId: string, binding: XiaobaiOsChatBindingV1): void {
        void index.remember(osId, binding).catch(error => {
            console.warn('[LittleWhiteBox] 小白 OS sidecar 索引登记失败', error);
        });
    }

    async function finishReference(
        entry: PendingNewSidecar,
        allowWrite: boolean,
    ): Promise<ChatBindingResolution> {
        if (!allowWrite) {
            try {
                const persisted = await metadata.read(entry.capture.binding);
                const actual = persisted ? readXiaobaiOsReference(persisted) : null;
                if (actual?.osId === entry.candidate.osId) {
                    pending.delete(entry.capture.identityKey);
                    rememberBestEffort(entry.candidate.osId, entry.capture.binding);
                    return { status: 'ready', envelope: entry.candidate, created: true };
                }
            } catch {
                return { status: 'unconfirmed', osId: entry.candidate.osId };
            }
            return { status: 'unconfirmed', osId: entry.candidate.osId };
        }
        entry.referenceAttempted = true;
        const installed = await references.install(entry.referenceCapture, {
            formatVersion: 1,
            osId: entry.candidate.osId,
        });
        if (installed.status === 'confirmed') {
            pending.delete(entry.capture.identityKey);
            rememberBestEffort(entry.candidate.osId, entry.capture.binding);
            return { status: 'ready', envelope: entry.candidate, created: true };
        }
        if (installed.status === 'unconfirmed') { return { status: 'unconfirmed', osId: entry.candidate.osId }; }
        pending.delete(entry.capture.identityKey);
        try {
            await storage.delete(entry.candidate.osId);
        } catch {
            rememberBestEffort(entry.candidate.osId, entry.capture.binding);
        }
        return { status: 'failed', error: installed.error };
    }

    async function continuePending(
        entry: PendingNewSidecar,
        retry: boolean,
    ): Promise<ChatBindingResolution> {
        if (entry.stage === 'replace') {
            let observed: XiaobaiOsSidecarV1 | null;
            try {
                observed = await storage.read(entry.candidate.osId);
            } catch {
                return { status: 'unconfirmed', osId: entry.candidate.osId };
            }
            if (observed?.commitId === entry.candidate.commitId) {
                entry.stage = 'reference';
            } else if (observed) {
                return { status: 'conflict', error: failure('storage_conflict', 'New sidecar path contains other data', false) };
            } else if (!retry) {
                return { status: 'unconfirmed', osId: entry.candidate.osId };
            } else {
                const written = await storage.replace({ expected: null, candidate: entry.candidate });
                if (written.status === 'failed') { return { status: 'failed', error: written.error }; }
                if (written.status !== 'confirmed') {
                    return written.status === 'conflict'
                        ? { status: 'conflict', error: failure('storage_conflict', 'New sidecar path contains other data', false) }
                        : { status: 'unconfirmed', osId: entry.candidate.osId };
                }
                entry.stage = 'reference';
            }
        }
        return await finishReference(entry, retry || !entry.referenceAttempted);
    }

    async function completeNewSidecar(
        capture: ChatMetadataCapture,
        candidate: XiaobaiOsSidecarV1,
    ): Promise<ChatBindingResolution> {
        const entry: PendingNewSidecar = {
            capture,
            referenceCapture: captureForReference(capture),
            candidate,
            stage: 'replace',
            referenceAttempted: false,
        };
        const written = await storage.replace({ expected: null, candidate });
        if (written.status === 'failed') { return { status: 'failed', error: written.error }; }
        if (written.status === 'unconfirmed' || written.status === 'conflict') {
            if (written.status === 'unconfirmed') { pending.set(capture.identityKey, entry); }
            return written.status === 'conflict'
                ? { status: 'conflict', error: failure('storage_conflict', 'New sidecar path already contains other data', false) }
                : { status: 'unconfirmed', osId: candidate.osId };
        }
        entry.stage = 'reference';
        entry.referenceAttempted = true;
        const installed = await references.install(entry.referenceCapture, {
            formatVersion: 1,
            osId: candidate.osId,
        });
        if (installed.status === 'confirmed') {
            rememberBestEffort(candidate.osId, capture.binding);
            return { status: 'ready', envelope: candidate, created: true };
        }
        if (installed.status === 'unconfirmed') {
            pending.set(capture.identityKey, entry);
            return { status: 'unconfirmed', osId: candidate.osId };
        }
        try {
            await storage.delete(candidate.osId);
        } catch {
            rememberBestEffort(candidate.osId, capture.binding);
        }
        return { status: 'failed', error: installed.error };
    }

    async function cloneForCurrent(
        capture: ChatMetadataCapture,
        source: XiaobaiOsSidecarV1,
    ): Promise<ChatBindingResolution> {
        const partitions = cloneJsonValue(source.partitions);
        options.prepareClonedPartitions?.(capture, source.binding, partitions);
        const candidate: XiaobaiOsSidecarV1 = {
            formatVersion: 1,
            osId: createId(),
            binding: { ...capture.binding },
            revision: 0,
            commitId: createId(),
            partitions,
        };
        return await completeNewSidecar(capture, candidate);
    }

    async function updateBinding(
        capture: ChatMetadataCapture,
        source: XiaobaiOsSidecarV1,
    ): Promise<ChatBindingResolution> {
        const candidate: XiaobaiOsSidecarV1 = {
            ...cloneJsonValue(source),
            binding: { ...capture.binding },
            revision: source.revision + 1,
            commitId: createId(),
        };
        const result = await storage.replace({ expected: expectedRevision(source), candidate });
        if (result.status === 'confirmed') {
            rememberBestEffort(candidate.osId, candidate.binding);
            return { status: 'ready', envelope: candidate, created: false };
        }
        if (result.status === 'unconfirmed') { return { status: 'unconfirmed', osId: candidate.osId }; }
        if (result.status === 'conflict') {
            return { status: 'conflict', error: failure('identity_conflict', 'Sidecar binding update conflicted', false) };
        }
        return { status: 'failed', error: result.error };
    }

    async function resolveReferenced(
        capture: ChatMetadataCapture,
        osId: string,
    ): Promise<ChatBindingResolution> {
        let sidecar: XiaobaiOsSidecarV1 | null;
        try {
            sidecar = await storage.read(osId);
        } catch (error) {
            return {
                status: 'failed',
                error: failure(
                    'storage_read_failed',
                    error instanceof Error ? error.message : 'Could not read sidecar',
                    true,
                ),
            };
        }
        if (!sidecar) {
            return { status: 'failed', error: failure('storage_missing', 'Referenced sidecar is missing', true) };
        }
        if (sameBinding(sidecar.binding, capture.binding)) {
            rememberBestEffort(osId, capture.binding);
            return { status: 'ready', envelope: sidecar, created: false };
        }

        // A still-existing former owner proves this is a copied/imported chat. Absence proves a missed rename.
        try {
            const formerChat = await metadata.read(sidecar.binding);
            if (formerChat !== null) { return await cloneForCurrent(capture, sidecar); }
            return await updateBinding(capture, sidecar);
        } catch {
            return {
                status: 'conflict',
                error: failure(
                    'identity_conflict',
                    'Could not determine whether the sidecar reference was copied or renamed',
                    true,
                ),
            };
        }
    }

    async function resolveBranch(capture: ChatMetadataCapture): Promise<ChatBindingResolution> {
        const mainChatId = String(capture.mainChatId || '').trim();
        if (!mainChatId) { return { status: 'empty' }; }
        const parentBinding = { ...capture.binding, chatId: mainChatId };
        let parentMetadata;
        try {
            parentMetadata = await metadata.read(parentBinding);
        } catch (error) {
            return {
                status: 'failed',
                error: failure(
                    'branch_parent_unavailable',
                    error instanceof Error ? error.message : 'Could not read branch parent',
                    true,
                ),
            };
        }
        if (!parentMetadata) { return { status: 'empty' }; }
        let parentReference;
        try {
            parentReference = readXiaobaiOsReference(parentMetadata);
        } catch (error) {
            return {
                status: 'failed',
                error: failure(
                    'branch_parent_invalid',
                    error instanceof Error ? error.message : 'Branch parent reference is invalid',
                    false,
                ),
            };
        }
        if (!parentReference) { return { status: 'empty' }; }
        try {
            const parentSidecar = await storage.read(parentReference.osId);
            if (!parentSidecar) {
                return { status: 'failed', error: failure('branch_parent_missing', 'Branch parent sidecar is missing', true) };
            }
            return await cloneForCurrent(capture, parentSidecar);
        } catch (error) {
            return {
                status: 'failed',
                error: failure(
                    'branch_parent_unavailable',
                    error instanceof Error ? error.message : 'Could not copy branch parent sidecar',
                    true,
                ),
            };
        }
    }

    async function resolveCurrent(): Promise<ChatBindingResolution> {
        const capture = metadata.capture();
        if (!capture) {
            return { status: 'failed', error: failure('chat_unavailable', 'No chat is currently open', false) };
        }
        const pendingEntry = pending.get(capture.identityKey);
        if (pendingEntry) {
            if (!sameBinding(pendingEntry.capture.binding, capture.binding)) {
                return { status: 'conflict', error: failure('identity_conflict', 'Pending sidecar belongs to another chat', false) };
            }
            return await continuePending(pendingEntry, false);
        }
        let reference;
        try {
            reference = readXiaobaiOsReference(capture.metadata);
        } catch (error) {
            return {
                status: 'failed',
                error: failure(
                    'invalid_chat_metadata',
                    error instanceof Error ? error.message : 'Chat reference is invalid',
                    false,
                ),
            };
        }
        return reference ? await resolveReferenced(capture, reference.osId) : await resolveBranch(capture);
    }

    async function retryPendingCurrent(): Promise<ChatBindingResolution> {
        const capture = metadata.capture();
        if (!capture) {
            return { status: 'failed', error: failure('chat_unavailable', 'No chat is currently open', false) };
        }
        const entry = pending.get(capture.identityKey);
        return entry ? await continuePending(entry, true) : await resolveCurrent();
    }

    async function handleChatDeleted(chatId: string, ownerLocator?: string): Promise<'deleted' | 'retained'> {
        const matches = await index.findByChatId(chatId, ownerLocator);
        if (matches.length !== 1) { return 'retained'; }
        const [osId] = matches;
        try {
            await storage.delete(osId);
            await index.forget(osId);
            return 'deleted';
        } catch {
            return 'retained';
        }
    }

    async function handleCharacterRenamed(oldOwnerLocator: string, newOwnerLocator: string): Promise<void> {
        await index.updateOwner(oldOwnerLocator, newOwnerLocator);
    }

    return Object.freeze({ resolveCurrent, retryPendingCurrent, handleChatDeleted, handleCharacterRenamed });
}
