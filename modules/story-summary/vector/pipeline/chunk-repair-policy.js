/** 已存片段是补向量的材料来源；当前正文只用于补缺失片段，不改写旧材料。 */
export function selectChunksForRepair(expected, storedChunks, vectorDescriptors, fingerprint) {
    const stored = new Map(storedChunks.map(chunk => [chunk.chunkId, chunk]));
    const candidates = new Map(stored);
    for (const chunk of expected) {
        if (!candidates.has(chunk.chunkId)) candidates.set(chunk.chunkId, chunk);
    }
    const validIds = new Set(vectorDescriptors
        .filter(item => item.valid && item.fingerprint === fingerprint)
        .map(item => item.chunkId));
    // 缺材料时，即使同 ID 留有向量，也需按补出的材料重新配对。
    return [...candidates.values()]
        .filter(chunk => !stored.has(chunk.chunkId) || !validIds.has(chunk.chunkId));
}
