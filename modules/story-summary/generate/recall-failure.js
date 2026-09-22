export const RECALL_TIMEOUT_MS = 30_000;
export const RECALL_TIMEOUT_REASONS = Object.freeze({
    host: 'host-wait-timeout',
    compute: 'recall-timeout',
});

/** Cancellation is not failure; report only the deadline that actually expired. */
export function recallFailureNotice(cancelReason, error, timeoutMs = RECALL_TIMEOUT_MS) {
    const seconds = timeoutMs / 1000;
    if (cancelReason === RECALL_TIMEOUT_REASONS.host) {
        return {
            issueCode: 'recall_host_wait_timeout',
            notice: `剧情记忆等待本轮用户消息超过 ${seconds} 秒，尚未开始召回，本轮已跳过。请检查酒馆生成准备流程。`,
        };
    }
    if (cancelReason === RECALL_TIMEOUT_REASONS.compute) {
        return {
            issueCode: 'recall_timeout',
            notice: `剧情记忆召回计算超过 ${seconds} 秒，本轮已跳过。请查看召回日志中的阶段和错误详情。`,
        };
    }
    if (cancelReason) return null;
    if (error?.code === 'RECALL_EMBEDDING_FAILED' || error?.code === 'RECALL_EMBEDDING_INVALID_RESPONSE') {
        return {
            issueCode: 'recall_embedding_failed',
            notice: '剧情记忆嵌入请求失败，本轮已跳过。请检查嵌入 API、网络和向量设置后重试。',
        };
    }
    return {
        issueCode: 'recall_failed',
        notice: '剧情记忆召回失败，本轮已跳过。请查看召回日志中的阶段和错误详情。',
    };
}
