import { normalizeTavilyApiKey, normalizeTavilyBaseUrl } from '../../../../agent-core/tavily-search.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class LearningMaterialError extends Error {
    constructor(readonly code: string) { super(code); }
}

export interface ExtractedSources {
    results: { url: string; text: string }[];
    failedUrls: string[];
}

export function learningPublicUrl(value: string): string {
    try {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
            || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
            || /\.(localhost|local|internal)$/i.test(url.hostname)) { throw new Error(); }
        return url.href;
    } catch { throw new LearningMaterialError('learning_source_url_invalid'); }
}

async function boundedJson(response: Response): Promise<unknown> {
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new LearningMaterialError('learning_source_too_large');
    }
    const reader = response.body?.getReader();
    if (!reader) { throw new LearningMaterialError('learning_extract_invalid_response'); }
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
        while (true) {
            const item = await reader.read();
            if (item.done) { break; }
            bytes += item.value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                throw new LearningMaterialError('learning_source_too_large');
            }
            text += decoder.decode(item.value, { stream: true });
        }
        text += decoder.decode();
    } finally { reader.releaseLock(); }
    try { return JSON.parse(text) as unknown; }
    catch { throw new LearningMaterialError('learning_extract_invalid_response'); }
}

function projectSources(payload: unknown, urls: readonly string[]): ExtractedSources {
    if (!payload || typeof payload !== 'object' || !('results' in payload) || !Array.isArray(payload.results)) {
        throw new LearningMaterialError('learning_extract_invalid_response');
    }
    const texts = new Map<string, string>();
    for (const item of payload.results as unknown[]) {
        if (!item || typeof item !== 'object' || !('url' in item) || typeof item.url !== 'string'
            || !('raw_content' in item) || typeof item.raw_content !== 'string' || !item.raw_content.trim()) { continue; }
        let url;
        try { url = learningPublicUrl(item.url); } catch { continue; }
        if (urls.includes(url)) { texts.set(url, item.raw_content); }
    }
    return {
        results: urls.filter(url => texts.has(url)).map(url => ({ url, text: texts.get(url)! })),
        // Provider error bodies are not learning material and may contain private proxy diagnostics.
        failedUrls: urls.filter(url => !texts.has(url)),
    };
}

/** Transport only. The lesson tool must supply URLs from its own current search results. */
export async function extractLearningSources(
    config: { tavilyApiKey?: string; tavilyBaseUrl?: string },
    inputUrls: readonly string[],
    options: { signal?: AbortSignal; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Promise<ExtractedSources> {
    const key = normalizeTavilyApiKey(config.tavilyApiKey);
    if (!key) { throw new LearningMaterialError('learning_search_not_configured'); }
    if (inputUrls.length < 1 || inputUrls.length > 2) { throw new LearningMaterialError('learning_extract_url_limit'); }
    const urls = [...new Set(inputUrls.map(learningPublicUrl))];
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) { abort(); }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; abort(); }, options.timeoutMs ?? 30_000);
    try {
        if (controller.signal.aborted) { throw new LearningMaterialError('learning_extract_cancelled'); }
        const request = options.fetch ?? globalThis.fetch.bind(globalThis);
        const response = await request(`${normalizeTavilyBaseUrl(config.tavilyBaseUrl)}/extract`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ urls, extract_depth: 'basic', format: 'text', include_images: false }),
        });
        if (!response.ok) {
            await response.body?.cancel();
            throw new LearningMaterialError('learning_extract_http_failed');
        }
        const payload = await boundedJson(response);
        if (controller.signal.aborted) { throw new LearningMaterialError('learning_extract_cancelled'); }
        return projectSources(payload, urls);
    } catch (error) {
        if (controller.signal.aborted) {
            throw new LearningMaterialError(timedOut ? 'learning_extract_timeout' : 'learning_extract_cancelled');
        }
        if (error instanceof LearningMaterialError) { throw error; }
        throw new LearningMaterialError('learning_extract_failed');
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
    }
}
