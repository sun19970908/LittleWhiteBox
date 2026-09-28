// One rerank document keeps the complete USER side and only the AI side's
// three strongest cosine hits with their immediate same-message neighbours.
// Preserve source order without mutating the scored lists used by L1 recall.
export function selectContextualRerankChunks({ userChunks, aiChunks }) {
    const aiByIndex = new Map(aiChunks.map(chunk => [chunk.chunkIdx, chunk]));
    const anchors = [...aiChunks]
        .sort((left, right) => right._cosineScore - left._cosineScore).slice(0, 3);
    const selectedAi = new Map();
    for (const anchor of anchors) {
        for (const index of [anchor.chunkIdx - 1, anchor.chunkIdx, anchor.chunkIdx + 1]) {
            const chunk = aiByIndex.get(index);
            if (chunk) selectedAi.set(chunk.chunkId, chunk);
        }
    }
    const byPosition = (left, right) => left.chunkIdx - right.chunkIdx;
    return {
        userChunks: [...userChunks].sort(byPosition),
        aiChunks: [...selectedAi.values()].sort(byPosition),
    };
}
