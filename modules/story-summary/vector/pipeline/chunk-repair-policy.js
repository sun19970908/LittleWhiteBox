import { inputDigest } from '../utils/vector-input-digest.js';
import { matchesVectorSource } from '../utils/vector-source.js';

/** 从统一的材料集合中挑出缺失或无效的配对。 */
export function selectChunksForRepair(materials, storedChunks, vectorDescriptors, fingerprint) {
    const stored = new Set(storedChunks.map(chunk => chunk.chunkId));
    const byId = new Map(vectorDescriptors.map(item => [item.chunkId, item]));
    // 缺材料时，即使同 ID 留有向量，也需按补出的材料重新配对。
    return materials
        .filter(chunk => {
            const vector = byId.get(chunk.chunkId);
            return !stored.has(chunk.chunkId) || !vector?.valid || vector.fingerprint !== fingerprint
                || !matchesVectorSource(vector, { sourceHash: inputDigest('chunk', chunk.text) });
        });
}
