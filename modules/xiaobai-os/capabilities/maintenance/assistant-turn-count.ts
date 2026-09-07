type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Counts the host's non-User, non-system Assistant messages, including empty ones. */
export function countAssistantTurns(messages: readonly unknown[], boundary = messages.length): number {
    let count = 0;
    for (let index = 0; index < Math.min(boundary, messages.length); index += 1) {
        const message = messages[index];
        if (!isRecord(message)
            || message.is_system === true
            || message.is_user === true
            || message.role === 'system'
            || message.role === 'user') {
            continue;
        }
        count += 1;
    }
    return count;
}
