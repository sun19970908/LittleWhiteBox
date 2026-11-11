export const TOOL_RESULT_PAGE_CHARS = 12_000;

const pageError = code => Object.assign(new Error(code), { code });

export function textPage(text, value = 0, rangeError = 'tool_result_range_invalid') {
    if (!Number.isSafeInteger(value) || value < 0 || value > text.length) throw pageError(rangeError);
    let end = Math.min(text.length, value + TOOL_RESULT_PAGE_CHARS);
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1])) end--;
    return { text: text.slice(value, end), offset: value, nextOffset: end < text.length ? end : null, totalChars: text.length };
}

/** One run owns the store. Continuations retain ranges, not serialized copies. */
export function createToolResultPages({ budgetChars, serialize = JSON.stringify,
    expiredError = 'tool_result_expired', rangeError = 'tool_result_range_invalid' }) {
    /** @type {Map<string, string | {reference: string, offset: number, length: number}>} */
    const entries = new Map();
    let chars = 0;
    function source(reference) {
        const value = entries.get(reference);
        if (typeof value !== 'string') throw pageError(expiredError);
        return value;
    }
    function remove(id) {
        const old = entries.get(id);
        entries.delete(id);
        if (typeof old === 'string') {
            chars -= old.length;
            for (const [key, value] of entries) {
                if (typeof value !== 'string' && value.reference === id) entries.delete(key);
            }
        }
    }
    return {
        clear() { entries.clear(); chars = 0; },
        project(id, result, { sourcePaged = false, boundedSource = false } = {}) {
            const full = serialize(result);
            remove(id);
            // Transport-bounded sources may occupy the store alone, avoiding another paid read.
            const budget = boundedSource ? Math.max(budgetChars, full.length) : budgetChars;
            if (full.length > budget) return { ok: result.ok, status: result.status, detailsUnavailable: 'result_exceeds_evidence_budget', totalChars: full.length };
            while (chars + full.length > budget) remove(entries.keys().next().value);
            entries.set(id, full);
            chars += full.length;
            return sourcePaged || full.length <= TOOL_RESULT_PAGE_CHARS ? result
                : { ok: result.ok, status: result.status, data: { reference: id, ...textPage(full) } };
        },
        page(id, reference, offset) {
            const page = textPage(source(reference), offset, rangeError);
            entries.set(id, { reference, offset: page.offset, length: page.text.length });
            return { reference, ...page };
        },
        read(id, offset) {
            const entry = entries.get(id);
            if (entry === undefined) throw pageError(expiredError);
            const text = typeof entry === 'string' ? entry : source(entry.reference).slice(entry.offset, entry.offset + entry.length);
            return textPage(text, offset, rangeError);
        },
    };
}
