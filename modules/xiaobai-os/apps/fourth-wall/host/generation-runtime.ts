import type { FourthWallBuiltPrompt, FourthWallGenerationResult } from '../types.js';

export interface FourthWallGenerateOptions {
    config: unknown;
    builtPrompt: FourthWallBuiltPrompt;
    stream: boolean;
    disableAssistantPrefill: boolean;
    signal: AbortSignal;
    onStreamProgress?: (snapshot: FourthWallGenerationResult) => void;
}

export type FourthWallGenerateResponse = (options: FourthWallGenerateOptions) => Promise<FourthWallGenerationResult>;

export interface FourthWallGenerationStartOptions {
    requestId: string;
    builtPrompt: FourthWallBuiltPrompt;
    stream: boolean;
    disableAssistantPrefill: boolean;
    onProgress?: (snapshot: FourthWallGenerationResult) => void;
    onComplete?: (result: FourthWallGenerationResult) => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
    onCancelled?: (reason: string) => void;
}

export type FourthWallGenerationOutcome =
    | { status: 'completed'; result: FourthWallGenerationResult }
    | { status: 'cancelled' }
    | { status: 'failed'; error: unknown };

interface ActiveGeneration {
    sequence: number;
    requestId: string;
    controller: AbortController;
    onCancelled?: (reason: string) => void;
}

export interface FourthWallGenerationRuntime {
    start: (options: FourthWallGenerationStartOptions) => {
        requestId: string;
        done: Promise<FourthWallGenerationOutcome>;
    };
    cancel: (reason?: string) => boolean;
    isRunning: () => boolean;
    getRequestId: () => string;
}

function isAbortError(error: unknown): boolean {
    const candidate = error as { name?: unknown; message?: unknown } | null | undefined;
    const name = String(candidate?.name || '');
    const message = String(candidate?.message || error || '');
    return name === 'AbortError' || /abort|aborted|已取消/i.test(message);
}

export function createFourthWallGenerationRuntime({
    generateResponse,
    loadAgentConfig,
}: {
    generateResponse: FourthWallGenerateResponse;
    loadAgentConfig: () => unknown | Promise<unknown>;
}): FourthWallGenerationRuntime {
    if (typeof generateResponse !== 'function' || typeof loadAgentConfig !== 'function') {
        throw new TypeError('generation runtime requires generateResponse and loadAgentConfig');
    }

    let sequence = 0;
    let active: ActiveGeneration | null = null;

    function isCurrent(run: ActiveGeneration): boolean {
        return active === run && run.sequence === sequence && !run.controller.signal.aborted;
    }

    function cancel(reason = 'cancelled'): boolean {
        if (!active) {
            return false;
        }
        const run = active;
        active = null;
        sequence += 1;
        run.controller.abort(reason);
        run.onCancelled?.(reason);
        return true;
    }

    function start(options: FourthWallGenerationStartOptions) {
        cancel('superseded');
        const run: ActiveGeneration = {
            sequence: ++sequence,
            requestId: String(options.requestId || ''),
            controller: new AbortController(),
            onCancelled: options.onCancelled,
        };
        active = run;

        const done: Promise<FourthWallGenerationOutcome> = Promise.resolve()
            .then(async (): Promise<FourthWallGenerationOutcome> => {
                const config = await loadAgentConfig();
                if (!isCurrent(run)) {
                    return { status: 'cancelled' };
                }
                const result = await generateResponse({
                    config,
                    builtPrompt: options.builtPrompt,
                    stream: options.stream === true,
                    disableAssistantPrefill: options.disableAssistantPrefill === true,
                    signal: run.controller.signal,
                    onStreamProgress(snapshot: FourthWallGenerationResult) {
                        if (isCurrent(run)) {
                            options.onProgress?.(snapshot || {});
                        }
                    },
                });
                if (!isCurrent(run)) {
                    return { status: 'cancelled' };
                }
                await options.onComplete?.(result || {});
                if (active === run) {
                    active = null;
                }
                return { status: 'completed', result };
            })
            .catch(async (error) => {
                if (run.controller.signal.aborted || run.sequence !== sequence || isAbortError(error)) {
                    if (active === run) {
                        active = null;
                        run.onCancelled?.('aborted');
                    }
                    return { status: 'cancelled' };
                }
                active = null;
                await options.onError?.(error);
                return { status: 'failed', error };
            });

        return Object.freeze({ requestId: run.requestId, done });
    }

    return Object.freeze({
        start,
        cancel,
        isRunning: () => active !== null,
        getRequestId: () => active?.requestId || '',
    });
}
