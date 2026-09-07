type JsonResult = { ok: true; value: unknown } | { ok: false };

/** Repair only structural trailing commas; quoted content is never rewritten. */
function repairTrailingCommas(source: string): string {
    const parts: string[] = [];
    let from = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (quoted) {
            if (escaped) {escaped = false;}
            else if (character === '\\') {escaped = true;}
            else if (character === '"') {quoted = false;}
            continue;
        }
        if (character === '"') {quoted = true; continue;}
        if (character !== ',') {continue;}
        let next = index + 1;
        while (source[next] === ' ' || source[next] === '\t' || source[next] === '\r' || source[next] === '\n') {
            next += 1;
        }
        if (source[next] === '}' || source[next] === ']') {
            parts.push(source.slice(from, index));
            from = index + 1;
        }
    }
    return parts.length ? parts.join('') + source.slice(from) : source;
}

function parseJsonCandidate(source: string): JsonResult {
    try {
        return { ok: true, value: JSON.parse(source) as unknown };
    } catch {
        const repaired = repairTrailingCommas(source);
        if (repaired === source) {return { ok: false };}
        try {
            return { ok: true, value: JSON.parse(repaired) as unknown };
        } catch {
            return { ok: false };
        }
    }
}

/** Scan disjoint outer objects once; never salvage nested fragments of a broken response. */
export function extractTaskJsonValue(source: string):
    | { ok: true; value: unknown }
    | { ok: false; reason: 'response_truncated' | 'json_not_found' } {
    const direct = parseJsonCandidate(source.trim());
    if (direct.ok) {return direct;}

    let start = -1;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (start < 0) {
            if (character !== '{') {continue;}
            start = index;
        }
        if (quoted) {
            if (escaped) {escaped = false;}
            else if (character === '\\') {escaped = true;}
            else if (character === '"') {quoted = false;}
            continue;
        }
        if (character === '"') {quoted = true; continue;}
        if (character === '{') {depth += 1; continue;}
        if (character !== '}') {continue;}
        depth -= 1;
        if (depth !== 0) {continue;}
        const parsed = parseJsonCandidate(source.slice(start, index + 1));
        if (parsed.ok) {return parsed;}
        start = -1;
    }
    return { ok: false, reason: start < 0 ? 'json_not_found' : 'response_truncated' };
}
