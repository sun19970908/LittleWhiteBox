// Model-output tolerance for the current images-only contract, not a legacy schema
// migration. Remove this fallback if the planner transport guarantees valid JSON.
const IMAGES_PREFIX = /^[ \t\r\n]*\{[ \t\r\n]*"images"[ \t\r\n]*:[ \t\r\n]*(?=\[)/;

function findCompleteArrayEnd(source, start) {
    const stack = [];
    let stringStart = -1;
    for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (stringStart >= 0) {
            if (char === '\\') index += 1;
            else if (char === '"') {
                const frame = stack[stack.length - 1];
                let next = index + 1;
                while (/[ \t\r\n]/.test(source[next] || '')) next += 1;
                if (frame?.keys && source[next] === ':') {
                    const key = JSON.parse(source.slice(stringStart, index + 1));
                    // JSON.parse would silently discard an earlier duplicate value.
                    if (frame.keys.has(key)) return -1;
                    frame.keys.add(key);
                }
                stringStart = -1;
            }
        } else if (char === '"') stringStart = index;
        else if (char === '[' || char === '{') {
            stack.push({ close: char === '[' ? ']' : '}', keys: char === '{' ? new Set() : null });
        } else if (char === ']' || char === '}') {
            if (stack.pop()?.close !== char) return -1;
            if (!stack.length) return index + 1;
        }
    }
    return -1;
}

/** Only repair the shell AFTER a complete images array; never edit its contents. */
export function repairScenePlanArguments(source) {
    const prefix = source.match(IMAGES_PREFIX);
    if (!prefix) return null;
    try {
        const arrayEnd = findCompleteArrayEnd(source, prefix[0].length);
        if (arrayEnd < 0) return null;
        const tail = source.slice(arrayEnd);
        let argumentRepair;
        if (/^[ \t\r\n]*$/.test(tail)) {
            argumentRepair = { kind: 'missing_root_closer', offset: source.length, removed: '', inserted: '}' };
        } else {
            const rootClose = tail.match(/^[ \t\r\n]*\}/);
            if (!rootClose) return null;
            const offset = arrayEnd + rootClose[0].length;
            const suffix = source.slice(offset);
            if (!/^[ \t\r\n}\]]+$/.test(suffix) || !/[}\]]/.test(suffix)) return null;
            argumentRepair = { kind: 'trailing_closers', offset, removed: suffix, inserted: '' };
        }
        const repaired = source.slice(0, argumentRepair.offset) + argumentRepair.inserted;
        const parameters = JSON.parse(repaired);
        return { parameters, argumentRepair };
    } catch {
        // Invalid strings, duplicate/unfinished content or any other syntax error
        // stays a validation failure and uses the existing model correction loop.
        return null;
    }
}
