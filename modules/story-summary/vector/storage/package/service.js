import { getContext } from '../../../../../../../../extensions.js';
import { chat_metadata } from '../../../../../../../../../script.js';
import { EXT_ID } from '../../../../../core/constants.js';
import { getTextFilterRules } from '../../../data/config.js';
import { refreshRecallRuntime } from '../../runtime/runtime.js';
import { invalidateLexicalIndex } from '../../retrieval/lexical-index.js';
import { buildSourceIndex, resolvePackageSources } from './sources.js';
import { decodePackage, encodePackage, validatePackage } from './codec.js';
import { packageError, packageWarning, PACKAGE_PROGRESS } from './messages.js';
import { readVectorCache, replaceVectorCache } from './repository.js';

function readSources() {
    const memory = chat_metadata.extensions?.[EXT_ID];
    return {
        chat: (getContext()?.chat || []).map(message => ({ mes: message.mes, name: message.name, is_user: message.is_user })),
        atoms: memory?.stateAtoms || [],
        events: memory?.storySummary?.json?.events || [],
        filters: getTextFilterRules(),
    };
}

function captureOperation(options) {
    const chatId = options.targetChatId || getContext()?.chatId;
    if (!chatId) throw packageError('no_chat');
    const snapshot = structuredClone(readSources());
    const stamp = JSON.stringify(snapshot);
    const assertCurrent = () => {
        if (getContext()?.chatId !== chatId) throw packageError('chat_changed');
        if (options.signal?.aborted || options.isCurrent?.() === false) throw packageError('cancelled');
        if (JSON.stringify(readSources()) !== stamp) throw packageError('source_changed');
    };
    assertCurrent();
    return { chatId, sources: buildSourceIndex(snapshot), assertCurrent };
}

function storedVector(record, fingerprint) {
    // The ZIP declares one source model. Never relabel another record with it;
    // this is package consistency, not a comparison with the active API settings.
    if (record.fingerprint !== fingerprint) throw packageError('invalid_package', { field: 'fingerprint' });
    if (!record.sourceHash) throw packageError('incomplete_cache');
    return { vector: new Float32Array(record.vector), sourceHash: record.sourceHash };
}

function packageFromCache(cache, operation) {
    const { chatId, sources } = operation;
    const first = cache.chunkVectors[0] || cache.stateVectors[0] || cache.eventVectors[0];
    if (!first) throw packageError('empty_cache');
    const fingerprint = first.fingerprint;
    const cachedChunks = new Map(cache.chunks.map(chunk => [chunk.chunkId, chunk]));
    if (cachedChunks.size !== cache.chunkVectors.length) throw packageError('incomplete_cache');
    const data = {
        chatId, fingerprint, dims: first.dims,
        chunks: cache.chunkVectors.map(record => {
            const chunk = cachedChunks.get(record.chunkId);
            const current = sources.chunks.get(record.chunkId)?.chunk;
            if (!chunk || !current || chunk.text !== current.text || chunk.floor !== current.floor || chunk.chunkIdx !== current.chunkIdx) throw packageError('incomplete_cache');
            return { id: record.chunkId, floor: chunk.floor, index: chunk.chunkIdx, ...storedVector(record, fingerprint) };
        }),
        states: cache.stateVectors.map(record => {
            if (record.rVector && !record.relationHash) throw packageError('incomplete_cache');
            return {
                id: record.atomId, floor: record.floor, ...storedVector(record, fingerprint),
                relationHash: record.rVector ? record.relationHash : null,
                rVector: record.rVector ? new Float32Array(record.rVector) : null,
            };
        }),
        events: cache.eventVectors.map(record => ({ id: record.eventId, ...storedVector(record, fingerprint) })),
        warningCodes: [],
    };
    validatePackage(data);
    resolvePackageSources(data, sources);
    return data;
}

function resultCounts(data) {
    return { chunkCount: data.chunks.length, eventCount: data.events.length, stateVectorCount: data.states.length };
}

export async function createVectorPackage(onProgress, options = {}) {
    const operation = captureOperation(options);
    onProgress?.(PACKAGE_PROGRESS.read);
    const cache = await readVectorCache(operation.chatId);
    operation.assertCurrent();
    onProgress?.(PACKAGE_PROGRESS.validate);
    const data = packageFromCache(cache, operation);
    onProgress?.(PACKAGE_PROGRESS.pack);
    const bytes = encodePackage(data);
    operation.assertCurrent();
    return { bytes, chatId: operation.chatId, ...resultCounts(data) };
}

export async function restoreVectorPackage(bytes, onProgress, options = {}) {
    const operation = captureOperation(options);
    onProgress?.(PACKAGE_PROGRESS.validate);
    const data = decodePackage(bytes);
    if (data.chatId !== operation.chatId) throw packageError('source_mismatch', { kind: 'chat' });
    if (!data.chunks.length && !data.states.length && !data.events.length) {
        throw packageError(data.warningCodes.length ? 'legacy_unverifiable' : 'empty_cache');
    }
    const resolved = resolvePackageSources(data, operation.sources);
    operation.assertCurrent();
    onProgress?.(PACKAGE_PROGRESS.write);
    await replaceVectorCache(operation.chatId, data, resolved, operation.assertCurrent);
    // Both invalidations are in-memory and do not change chat metadata.
    invalidateLexicalIndex();
    await refreshRecallRuntime(operation.chatId, { reason: 'vector-package-restored' });
    return { ...resultCounts(data), warnings: data.warningCodes.map(packageWarning), warningCodes: data.warningCodes };
}
