function escapeStringBraces(serialized: string): string {
    let inString = false;
    let escaped = false;
    let output = '';
    for (const character of serialized) {
        if (!inString) {
            if (character === '"') { inString = true; }
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

export function safePromptJson(value: unknown): string {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) { throw new TypeError('Prompt data must be JSON serializable'); }
    return escapeStringBraces(serialized).replace(/[<>&]/gu, character => {
        if (character === '<') { return '\\u003c'; }
        if (character === '>') { return '\\u003e'; }
        return '\\u0026';
    });
}

export function escapePromptData(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/{/g, '&#123;')
        .replace(/}/g, '&#125;');
}
