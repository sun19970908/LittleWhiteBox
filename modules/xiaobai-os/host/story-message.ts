type Message = Record<string, unknown>;

function record(value: unknown): value is Message {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** SillyTavern also uses is_system to hide an otherwise ordinary chat floor. */
export function storyMessageRole(value: unknown): 'user' | 'assistant' | 'system' {
    if (!record(value)) {return 'system';}
    if (value.is_user === true || value.role === 'user') {return 'user';}
    const extra = record(value.extra) ? value.extra : null;
    if (value.role === 'system' || extra?.tool_invocations !== undefined
        || extra?.type === 'narrator'
        || value.is_system === true && (typeof extra?.type === 'string'
            || value.force_avatar === 'img/five.png')) {
        return 'system';
    }
    return 'assistant';
}

export function countStoryAssistantMessages(messages: readonly unknown[], boundary = messages.length): number {
    let count = 0;
    for (let index = 0; index < Math.min(boundary, messages.length); index += 1) {
        if (storyMessageRole(messages[index]) === 'assistant') {count += 1;}
    }
    return count;
}
