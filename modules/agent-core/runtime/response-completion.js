const COMPLETED_REASONS = {
    openai: ['stop', 'tool_calls', 'function_call'],
    anthropic: ['end_turn', 'stop_sequence', 'tool_use'],
    google: ['STOP'],
    responses: ['completed'],
};

const REFUSAL_REASONS = {
    openai: ['content_filter'],
    anthropic: ['refusal'],
    google: ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION'],
    responses: ['content_filter'],
};

/** Transport completion is metadata, not a verdict on the received content. */
export function readResponseCompletion(protocol, reason, refused = false, responseInfo = undefined, responseText = '') {
    // This relay reports an upstream HTTP failure in finish_reason despite HTTP 200.
    // Match its protocol marker, never error-like words in ordinary model prose.
    const proxyFailure = protocol === 'openai' && typeof reason === 'string'
        ? /^Proxy error \(HTTP ([45]\d{2})\b[^)]*\)$/i.exec(reason) : null;
    if (proxyFailure) {
        const error = new Error([reason, responseText].filter(Boolean).join('\n'));
        error.code = 'AGENT_PROVIDER_ERROR';
        error.status = Number(proxyFailure[1]);
        if (responseInfo !== undefined) error.responseInfo = responseInfo;
        throw error;
    }
    if (refused || REFUSAL_REASONS[protocol]?.includes(reason)) {
        const error = new Error('Model response was refused.');
        error.code = 'AGENT_RESPONSE_REFUSED';
        error.reason = reason;
        if (responseInfo !== undefined) error.responseInfo = responseInfo;
        throw error;
    }
    return {
        finishReason: reason,
        completion: COMPLETED_REASONS[protocol]?.includes(reason) ? 'complete' : 'incomplete',
        truncated: ['length', 'max_tokens', 'max_output_tokens', 'MAX_TOKENS'].includes(reason),
        ...(responseInfo !== undefined ? { responseInfo } : {}),
    };
}

/** An error thrown after the request went out (including an abnormal finish) still tells what was sent. */
export function attachRequestInspection(error, inspection) {
    if (inspection && error && typeof error === 'object' && !error.requestInspection) error.requestInspection = inspection;
    return error;
}
