interface DrawFacade {
    getStatus?: () => { enabled?: boolean; ready?: boolean };
    checkGeneratedImageCache?: (options: { prompt: string; cacheNamespace: string }) => Promise<unknown> | unknown;
    generateSharedImage?: (options: {
        prompt: string;
        cacheNamespace: string;
        signal: AbortSignal;
        onProgress: (status: string, ahead?: number, delay?: number) => void;
    }) => Promise<string>;
}

export interface FourthWallImageProgress {
    status: string;
    position: number;
    delay?: number;
}

export interface FourthWallImageProtocol {
    getCapabilities: () => { available: boolean };
    check: (options: { tags: unknown }) => Promise<{
        available: boolean;
        cached: unknown | null;
        tags: string;
    }>;
    generate: (options: {
        requestId: unknown;
        tags: unknown;
        onProgress?: (progress: FourthWallImageProgress) => void;
    }) => Promise<{ available: true; base64: string; tags: string }>;
    cancel: (requestId: unknown) => boolean;
    cancelAll: () => void;
}

function getWindowDrawFacade(): DrawFacade | undefined {
    return (window as Window & { xiaobaixDraw?: DrawFacade }).xiaobaixDraw;
}

function normalizeTags(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/^(?:nsfw|sketchy)\s*:\s*/i, 'nsfw, ')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .join(', ');
}

function getAvailability(facade: DrawFacade | undefined): boolean {
    const status = facade?.getStatus?.() || {};
    return status.enabled === true && status.ready === true && typeof facade?.generateSharedImage === 'function';
}

export function createFourthWallImageProtocol({
    getFacade = getWindowDrawFacade,
}: { getFacade?: () => DrawFacade | undefined } = {}): FourthWallImageProtocol {
    const active = new Map<string, AbortController>();

    function getCapabilities(): { available: boolean } {
        try {
            return { available: getAvailability(getFacade()) };
        } catch {
            return { available: false };
        }
    }

    async function check({ tags }: { tags: unknown }) {
        const prompt = normalizeTags(tags);
        if (!prompt) {
            throw new Error('无效的图片标签');
        }
        const facade = getFacade();
        if (!getAvailability(facade)) {
            return { available: false, cached: null, tags: prompt };
        }
        const cached =
            facade && typeof facade.checkGeneratedImageCache === 'function'
                ? await facade.checkGeneratedImageCache({ prompt, cacheNamespace: 'fourth-wall' })
                : null;
        return { available: true, cached: cached || null, tags: prompt };
    }

    async function generate({
        requestId,
        tags,
        onProgress,
    }: {
        requestId: unknown;
        tags: unknown;
        onProgress?: (progress: FourthWallImageProgress) => void;
    }): Promise<{ available: true; base64: string; tags: string }> {
        const id = String(requestId || '');
        const prompt = normalizeTags(tags);
        if (!id || !prompt) {
            throw new Error('无效的图片请求');
        }
        const facade = getFacade();
        if (!facade || !getAvailability(facade) || typeof facade.generateSharedImage !== 'function') {
            throw new Error('画图能力不可用');
        }
        active.get(id)?.abort();
        const controller = new AbortController();
        active.set(id, controller);
        try {
            const base64 = await facade.generateSharedImage({
                prompt,
                cacheNamespace: 'fourth-wall',
                signal: controller.signal,
                onProgress(status: string, ahead?: number, delay?: number) {
                    if (active.get(id) !== controller) {
                        return;
                    }
                    onProgress?.({
                        status: String(status || ''),
                        position: status === 'queued' ? Number(ahead || 0) + 1 : 0,
                        delay: delay ? Math.round(delay / 1000) : undefined,
                    });
                },
            });
            if (active.get(id) !== controller || controller.signal.aborted) {
                const error = new Error('image_request_cancelled');
                error.name = 'AbortError';
                throw error;
            }
            return { available: true, base64, tags: prompt };
        } finally {
            if (active.get(id) === controller) {
                active.delete(id);
            }
        }
    }

    function cancel(requestId: unknown): boolean {
        const controller = active.get(String(requestId || ''));
        if (!controller) {
            return false;
        }
        controller.abort();
        active.delete(String(requestId || ''));
        return true;
    }

    function cancelAll(): void {
        active.forEach((controller) => controller.abort());
        active.clear();
    }

    return Object.freeze({ getCapabilities, check, generate, cancel, cancelAll });
}
