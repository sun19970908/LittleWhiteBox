function getL0FailureCount(result) {
    return Math.max(0, Number(result?.llmFailed ?? result?.failed ?? 0) || 0);
}

/**
 * L1 直接来自正文，先独立补齐；L0 再提取事实、为成功事实补向量。
 * 两层分别记录成败，只有取消会阻止后续阶段，不以 L0 完整性限制 L1。
 */
export async function runVectorMaintenance({ buildChunks, extract, vectorize, inspect, isCancelled = () => false }) {
    if ([buildChunks, extract, vectorize, inspect].some(stage => typeof stage !== 'function')) {
        throw new TypeError('Vector maintenance requires chunk, extract, vectorize, and inspect stages');
    }

    const cancelledResult = (chunkResult = null, l0Result = null) => ({
        chunkResult,
        l0Result,
        l0VectorResult: null,
        l0Status: null,
        llmFailed: getL0FailureCount(l0Result),
        cancelled: true,
    });
    if (isCancelled()) return cancelledResult();
    const chunkResult = await buildChunks();
    if (isCancelled() || chunkResult?.status === 'cancelled') return cancelledResult(chunkResult);

    const l0Result = await extract();
    if (isCancelled() || l0Result?.cancelled) {
        return cancelledResult(chunkResult, l0Result);
    }

    const l0VectorResult = await vectorize(l0Result)
        || { success: true, status: 'up_to_date', vectorized: 0 };
    const l0Status = await inspect();
    const llmFailed = getL0FailureCount(l0Result);
    const cancelled = isCancelled() || Boolean(l0VectorResult?.cancelled);

    return {
        chunkResult,
        l0Result,
        l0VectorResult,
        l0Status,
        llmFailed,
        cancelled,
    };
}
