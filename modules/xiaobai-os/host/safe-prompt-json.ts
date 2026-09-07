function escapeStringBraces(serialized: string): string {
    let inString = false;
    let escaped = false;
    let output = '';
    for (const character of serialized) {
        if (!inString) {
            if (character === '"') {inString = true;}
            output += character;
            continue;
        }
        if (escaped) {
            output += character;
            escaped = false;
            continue;
        }
        if (character === '\\') {
            output += character;
            escaped = true;
            continue;
        }
        if (character === '"') {
            inString = false;
            output += character;
            continue;
        }
        output += character === '{' ? '\\u007b' : character === '}' ? '\\u007d' : character;
    }
    return output;
}

/** Serializes untrusted prompt data without allowing XML closure or host macro expansion. */
export function safePromptJson(value: unknown): string {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {throw new TypeError('Prompt data must be JSON serializable');}
    return escapeStringBraces(serialized).replace(/[<>&]/gu, character => {
        if (character === '<') {return '\\u003c';}
        if (character === '>') {return '\\u003e';}
        return '\\u0026';
    });
}
