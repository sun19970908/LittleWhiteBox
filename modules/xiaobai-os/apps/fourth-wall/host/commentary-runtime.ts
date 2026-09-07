const DEFAULT_COOLDOWN_MS = 180000;

interface CommentarySettings {
    enabled: boolean;
    probability: number;
}

interface CommentaryEventLike {
    kind?: string;
}

type TimerHandle = ReturnType<typeof setTimeout>;
type SetTimer = (callback: () => void, milliseconds: number) => TimerHandle;
type ClearTimer = (timer: TimerHandle) => void;

export interface FourthWallCommentaryRuntime<TEvent extends CommentaryEventLike = CommentaryEventLike> {
    start: () => void;
    sync: () => void;
    stop: () => void;
    cancel: () => boolean;
    handleEvent: (event: TEvent) => Promise<boolean>;
    isRunning: () => boolean;
}

export interface FourthWallCommentaryOptions<TEvent extends CommentaryEventLike, TCaptured> {
    getSettings?: () => CommentarySettings;
    subscribe?: (handler: (event: TEvent) => Promise<boolean>) => (() => void) | void;
    capture?: (event: TEvent) => TCaptured | null | Promise<TCaptured | null>;
    generate?: (captured: TCaptured, signal: AbortSignal) => Promise<unknown>;
    commit?: (captured: TCaptured, text: string, signal: AbortSignal) => Promise<void> | void;
    show?: (text: string) => void;
    hide?: () => void;
    isForegroundActive?: () => boolean;
    random?: () => number;
    now?: () => number;
    setTimer?: SetTimer;
    clearTimer?: ClearTimer;
    cooldownMs?: number;
}

function wait(milliseconds: number, signal: AbortSignal, setTimer: SetTimer, clearTimer: ClearTimer): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimer(resolve, milliseconds);
        signal.addEventListener(
            'abort',
            () => {
                clearTimer(timer);
                const error = new Error('commentary_cancelled');
                error.name = 'AbortError';
                reject(error);
            },
            { once: true },
        );
    });
}

export function createFourthWallCommentaryRuntime<TEvent extends CommentaryEventLike, TCaptured>({
    getSettings,
    subscribe,
    capture,
    generate,
    commit,
    show,
    hide,
    isForegroundActive = () => false,
    random = Math.random,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    cooldownMs = DEFAULT_COOLDOWN_MS,
}: FourthWallCommentaryOptions<TEvent, TCaptured> = {}): FourthWallCommentaryRuntime<TEvent> {
    let unsubscribe: (() => void) | null = null;
    let task: AbortController | null = null;
    let lastAcceptedAt = 0;

    function cancel(): boolean {
        const hadTask = task !== null;
        task?.abort();
        task = null;
        hide?.();
        return hadTask;
    }

    async function handleEvent(event: TEvent): Promise<boolean> {
        const settings = getSettings?.();
        if (!settings?.enabled || task || isForegroundActive()) {
            return false;
        }
        if (now() - lastAcceptedAt < cooldownMs) {
            return false;
        }
        const probability = Number(settings.probability);
        if (random() * 100 >= probability) {
            return false;
        }
        const controller = new AbortController();
        task = controller;
        try {
            const captured = await capture?.(event);
            if (!captured || controller.signal.aborted) {
                return false;
            }
            lastAcceptedAt = now();
            const delay = event?.kind === 'ai_message' ? 1000 + random() * 1000 : 500 + random() * 500;
            await wait(delay, controller.signal, setTimer, clearTimer);
            if (!generate || !commit) {
                return false;
            }
            const text = await generate(captured, controller.signal);
            if (controller.signal.aborted || !String(text || '').trim()) {
                return false;
            }
            await commit(captured, String(text).trim(), controller.signal);
            if (controller.signal.aborted) {
                return false;
            }
            show?.(String(text).trim());
            return true;
        } catch (error) {
            const errorName =
                error !== null && typeof error === 'object' && 'name' in error ? String(error.name) : '';
            if (errorName !== 'AbortError') {
                console.warn('[LittleWhiteBox] 四次元壁吐槽失败', error);
            }
            return false;
        } finally {
            if (task === controller) {
                task = null;
            }
        }
    }

    function sync(): void {
        const shouldSubscribe = getSettings?.()?.enabled === true;
        if (shouldSubscribe && !unsubscribe) {
            unsubscribe = subscribe?.(handleEvent) || (() => {});
        }
        if (!shouldSubscribe && unsubscribe) {
            cancel();
            unsubscribe();
            unsubscribe = null;
        }
    }

    function stop(): void {
        cancel();
        unsubscribe?.();
        unsubscribe = null;
        lastAcceptedAt = 0;
    }

    return Object.freeze({
        start: sync,
        sync,
        stop,
        cancel,
        handleEvent,
        isRunning: () => task !== null,
    });
}

export function createCommentaryBubblePresenter({
    documentTarget = document,
    windowTarget = window,
    anchorId = 'xiaobaix-os-button',
}: {
    documentTarget?: Document;
    windowTarget?: Window;
    anchorId?: string;
} = {}) {
    let bubble: HTMLButtonElement | null = null;
    let timer: number | null = null;

    function hide(): void {
        if (timer !== null) {
            windowTarget.clearTimeout(timer);
        }
        timer = null;
        bubble?.remove();
        bubble = null;
    }

    function show(text: unknown): boolean {
        hide();
        const anchor = documentTarget.getElementById(anchorId);
        if (!anchor) {
            return false;
        }
        const rect = anchor.getBoundingClientRect();
        bubble = documentTarget.createElement('button');
        bubble.type = 'button';
        bubble.className = 'xiaobaix-os-commentary';
        bubble.textContent = String(text || '');
        bubble.addEventListener('click', hide, { once: true });
        documentTarget.body.append(bubble);
        const bubbleRect = bubble.getBoundingClientRect();
        const left = Math.min(
            Math.max(8, rect.left + rect.width / 2 - bubbleRect.width / 2),
            Math.max(8, windowTarget.innerWidth - bubbleRect.width - 8),
        );
        bubble.style.left = `${left}px`;
        bubble.style.bottom = `${Math.max(8, windowTarget.innerHeight - rect.top + 8)}px`;
        const duration = Math.min(2000 + Math.ceil(String(text || '').length / 5) * 1000, 8000);
        timer = windowTarget.setTimeout(hide, duration);
        return true;
    }

    return Object.freeze({ show, hide, dispose: hide });
}
