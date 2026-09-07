interface VoicePlaybackHandle {
    stop?: () => void;
}

interface TtsFacade {
    isEnabled?: () => boolean;
    playTransient?: (
        text: string,
        emotion: string,
        options: {
            requestId: string;
            onState: (state: string, info?: { duration?: number; message?: string }) => void;
        },
    ) => VoicePlaybackHandle;
}

interface ActiveVoiceRequest {
    requestId: string;
    handle: VoicePlaybackHandle | null;
    onState?: (state: FourthWallVoiceState) => void;
    terminal: boolean;
}

export interface FourthWallVoiceState {
    requestId: string;
    state: string;
    duration?: number;
    message?: string;
}

export interface FourthWallVoiceProtocol {
    getCapabilities: () => { available: boolean };
    play: (options: {
        requestId: unknown;
        text: unknown;
        emotion?: unknown;
        onState?: (state: FourthWallVoiceState) => void;
    }) => { started: true; requestId: string };
    stop: (requestId?: string) => boolean;
    cancelAll: () => boolean;
}

function getWindowTtsFacade(): TtsFacade | undefined {
    return (window as Window & { xiaobaixTts?: TtsFacade }).xiaobaixTts;
}

export function createFourthWallVoiceProtocol({
    getFacade = getWindowTtsFacade,
}: { getFacade?: () => TtsFacade | undefined } = {}): FourthWallVoiceProtocol {
    let active: ActiveVoiceRequest | null = null;

    function isAvailable(): boolean {
        try {
            const facade = getFacade();
            return facade?.isEnabled?.() === true && typeof facade.playTransient === 'function';
        } catch {
            return false;
        }
    }

    function stop(requestId = ''): boolean {
        if (!active || (requestId && active.requestId !== requestId)) {
            return false;
        }
        const current = active;
        try {
            current.handle?.stop?.();
        } finally {
            if (!current.terminal) {
                current.terminal = true;
                current.onState?.({ requestId: current.requestId, state: 'stopped' });
            }
            if (active === current) {
                active = null;
            }
        }
        return true;
    }

    function play({
        requestId,
        text,
        emotion,
        onState,
    }: {
        requestId: unknown;
        text: unknown;
        emotion?: unknown;
        onState?: (state: FourthWallVoiceState) => void;
    }): { started: true; requestId: string } {
        const normalizedText = String(text || '').trim();
        const id = String(requestId || '');
        if (!normalizedText || !id) {
            throw new Error('无效的语音请求');
        }
        stop();
        const facade = getFacade();
        if (facade?.isEnabled?.() !== true || typeof facade.playTransient !== 'function') {
            throw new Error('TTS 能力不可用');
        }
        const record: ActiveVoiceRequest = { requestId: id, handle: null, onState, terminal: false };
        active = record;
        try {
            record.handle = facade.playTransient(normalizedText, String(emotion || ''), {
                requestId: id,
                onState(state: string, info?: { duration?: number; message?: string }) {
                    if (active !== record || record.terminal) {
                        return;
                    }
                    const normalizedState = String(state || '');
                    const terminal =
                        normalizedState === 'ended' || normalizedState === 'stopped' || normalizedState === 'error';
                    if (terminal) {
                        record.terminal = true;
                    }
                    record.onState?.({
                        requestId: id,
                        state: normalizedState,
                        duration: info?.duration,
                        message: info?.message,
                    });
                    if (terminal && active === record) {
                        active = null;
                    }
                },
            });
        } catch (error) {
            record.terminal = true;
            if (active === record) {
                active = null;
            }
            throw error;
        }
        return { started: true, requestId: id };
    }

    return Object.freeze({
        getCapabilities: () => ({ available: isAvailable() }),
        play,
        stop,
        cancelAll: () => stop(),
    });
}
