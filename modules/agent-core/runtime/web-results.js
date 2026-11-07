import { createToolResultPages } from './tool-result-pages.js';
import { WEB_RESPONSE_BYTES } from '../web/http.js';

/** One caller-owned run/session retains its web results until its owner clears them. */
export function createWebResults(createRequestId) {
    const pages = createToolResultPages({ budgetChars: WEB_RESPONSE_BYTES });
    const prefix = createRequestId('web-result');
    let sequence = 0;
    return {
        project(result) {
            const status = result.ok ? 'read' : result.results?.length ? 'partial' : 'failed';
            const projected = pages.project(`${prefix}:${++sequence}`, { ...result, status }, { boundedSource: true });
            if (!projected.data) return result;
            return { ...projected, ...(result.error ? { error: result.error, message: String(result.message || '').slice(0, 160) } : {}) };
        },
        read({ reference, offset }) {
            return { ok: true, data: { reference, ...pages.read(reference, offset) } };
        },
        clear() { pages.clear(); },
    };
}
