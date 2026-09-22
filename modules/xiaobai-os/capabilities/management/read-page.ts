export const MANAGEMENT_READ_CHARS = 12_000;
export const MANAGEMENT_PAGE_SIZE = 20;
export const MANAGEMENT_MAX_PAGE_SIZE = 50;

export function readOffset(value: unknown, fallback = 0, maximum = Number.MAX_SAFE_INTEGER): number {
    const offset = value === undefined ? fallback : value;
    if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 || offset > maximum) { throw new Error('management_read_range_invalid'); }
    return offset;
}

export function textPage(text: string, value?: unknown) {
    const offset = readOffset(value, 0, text.length);
    let end = Math.min(text.length, offset + MANAGEMENT_READ_CHARS);
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1])) { end--; }
    return { text: text.slice(offset, end), offset, nextOffset: end < text.length ? end : null, totalChars: text.length };
}
