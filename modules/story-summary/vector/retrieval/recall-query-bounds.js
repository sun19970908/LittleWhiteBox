// Recall dense-query inputs are sent to the embedding model independently.
// Keep each message below a conservative provider-safe character ceiling;
// this avoids coupling recall to a model-specific tokenizer.

export const RECALL_EMBEDDING_SEGMENT_MAX_CHARS = 6000;

function trimToTail(text, maxChars) {
    if (text.length <= maxChars) return text;
    if (maxChars <= 0) return '';
    if (maxChars === 1) return '…';

    let tail = text.slice(-(maxChars - 1));
    if (/^[\uDC00-\uDFFF]/.test(tail)) tail = tail.slice(1);
    return `…${tail}`;
}

/**
 * Bound one speaker-prefixed R1 embedding segment while preserving its speaker
 * identity and the most recent part of an oversized message.
 *
 * @param {string} text - `speaker：content` query segment
 * @param {number} maxChars - UTF-16 character ceiling for this single input
 * @returns {string}
 */
export function boundRecallEmbeddingSegment(
    text,
    maxChars = RECALL_EMBEDDING_SEGMENT_MAX_CHARS,
) {
    const value = String(text || '');
    const limit = Math.max(1, Math.trunc(Number(maxChars) || RECALL_EMBEDDING_SEGMENT_MAX_CHARS));
    if (value.length <= limit) return value;

    const separatorIndex = value.indexOf('：');
    const canPreserveSpeaker = separatorIndex >= 0 && separatorIndex + 2 < limit;
    if (!canPreserveSpeaker) return trimToTail(value, limit);

    const prefix = value.slice(0, separatorIndex + 1);
    const content = value.slice(separatorIndex + 1);
    return prefix + trimToTail(content, limit - prefix.length);
}
