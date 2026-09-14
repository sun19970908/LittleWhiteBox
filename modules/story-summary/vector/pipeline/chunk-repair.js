import { getAllChunks, getChunkVectorDescriptors, getMeta, updateMeta, saveChunkRepairs } from '../storage/chunk-store.js';
import { chunkMessage } from './chunk-builder.js';
import { embed, getEngineFingerprint } from '../utils/embedder.js';
import { getEmbeddingFailureDetails } from '../llm/embedding-failure.js';
import { selectChunksForRepair } from './chunk-repair-policy.js';

/** 完成楼层只用于自动增量；手动修补核对实际记录，包括中间缺口，保留已有材料。 */
export async function repairMissingChunks({ chatId, chat, vectorConfig, signal, shouldCancel, onProgress }) {
    const isCancelled = () => signal?.aborted || shouldCancel?.() === true;
    let repaired = 0;
    let phase = 'read';
    const cancelled = () => ({ success: false, cancelled: true, repaired });
    try {
        if (isCancelled()) return cancelled();
        const fingerprint = getEngineFingerprint(vectorConfig);
        const meta = await getMeta(chatId);
        if (meta.fingerprint && meta.fingerprint !== fingerprint) {
            return { success: false, repaired, code: 'fingerprint_mismatch' };
        }
        const [stored, vectors] = await Promise.all([getAllChunks(chatId), getChunkVectorDescriptors(chatId)]);
        if (isCancelled()) return cancelled();
        const expected = chat.flatMap((message, floor) => chunkMessage(floor, message));
        const missing = selectChunksForRepair(expected, stored, vectors, fingerprint);
        const storedIds = new Set(stored.map(chunk => chunk.chunkId));
        onProgress?.(0, missing.length);
        for (let i = 0; i < missing.length; i += 20) {
            if (isCancelled()) return cancelled();
            const batch = missing.slice(i, i + 20);
            phase = 'embedding';
            const embeddings = await embed(batch.map(chunk => chunk.text), vectorConfig, { signal });
            if (isCancelled()) return cancelled();
            phase = 'write';
            await saveChunkRepairs(chatId, batch.filter(chunk => !storedIds.has(chunk.chunkId)), batch.map((chunk, index) => ({
                chunkId: chunk.chunkId, vector: embeddings[index],
            })), fingerprint);
            repaired += batch.length;
            onProgress?.(repaired, missing.length);
        }
        if (isCancelled()) return cancelled();
        phase = 'metadata';
        await updateMeta(chatId, { lastChunkFloor: chat.length - 1, fingerprint });
        return { success: true, repaired };
    } catch (error) {
        if (isCancelled()) return cancelled();
        if (phase === 'embedding') {
            return { success: false, repaired, ...getEmbeddingFailureDetails(error), error };
        }
        const code = phase === 'write'
            ? 'vector_write_failed'
            : phase === 'metadata'
                ? 'metadata_write_failed'
                : 'chunk_read_failed';
        return { success: false, repaired, code, error };
    }
}
