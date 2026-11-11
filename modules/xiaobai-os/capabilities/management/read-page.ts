import { textPage as resultTextPage } from '../../../agent-core/runtime/tool-result-pages.js';
export { TOOL_RESULT_PAGE_CHARS as MANAGEMENT_READ_CHARS } from '../../../agent-core/runtime/tool-result-pages.js';
export const MANAGEMENT_PAGE_SIZE = 20;
export const MANAGEMENT_MAX_PAGE_SIZE = 50;

export function readOffset(value: unknown, fallback = 0, maximum = Number.MAX_SAFE_INTEGER): number {
    const offset = value === undefined ? fallback : value;
    if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 || offset > maximum) { throw new Error('management_read_range_invalid'); }
    return offset;
}

export function textPage(text: string, value?: unknown) {
    return resultTextPage(text, readOffset(value, 0, text.length));
}
