// Runtime-only source ownership. A producer may still be extending a native
// message; neither automatic nor explicit L2 generation may consume that suffix.
// Providers own their interpretation of messages and unregister on disposal.
const boundaries = new Set();

export function registerSummarySourceBoundary(boundary) {
    boundaries.add(boundary);
    return () => boundaries.delete(boundary);
}

export function getSummarySourceEnd(chat, requestedEnd, delayFloors = 0) {
    // Apply the delay to the current chat tail, not the requested target: that
    // target may already be capped, and retries must retain the same protection.
    let end = Math.min(requestedEnd, chat.length - 1 - delayFloors);
    for (const boundary of boundaries) {
        const stableEnd = boundary(chat);
        if (!Number.isSafeInteger(stableEnd) || stableEnd < -1 || stableEnd >= chat.length) {
            throw new Error('summary_source_boundary_invalid');
        }
        end = Math.min(end, stableEnd);
    }
    return end;
}
