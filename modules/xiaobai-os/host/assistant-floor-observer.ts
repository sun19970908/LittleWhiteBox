import { storyMessageRole } from './story-message.js';

export interface StorySurface {
    identityKey: string;
    messages: readonly unknown[];
}

interface Slot {
    seen: boolean;
    next?: Slot;
}

/** A chat floor's identity exists only for the lifetime of the current page. */
export function createAssistantFloorObserver(
    capture: () => StorySurface | null,
    onNewFloor: () => void,
) {
    let identity = '';
    let root: Slot = { seen: true };
    let slots = new WeakMap<object, Slot>();
    let active: { identity: string; streaming: boolean; sawText: boolean } | null = null;

    function reset(): void {
        identity = '';
        root = { seen: true };
        slots = new WeakMap<object, Slot>();
        active = null;
        baseline();
    }

    function slot(messages: readonly unknown[], index: number): Slot {
        if (index < 0) {return root;}
        const message = messages[index];
        if (!message || typeof message !== 'object') {return slot(messages, index - 1);}
        if (storyMessageRole(message) === 'system') {return slot(messages, index - 1);}
        const existing = slots.get(message);
        if (existing) {return existing;}
        const next: Slot = storyMessageRole(message) === 'user'
            ? { seen: true }
            : (slot(messages, index - 1).next ??= { seen: false });
        slots.set(message, next);
        return next;
    }

    function baseline(): StorySurface | null {
        const surface = capture();
        if (!surface?.identityKey) {return null;}
        if (identity !== surface.identityKey) {
            identity = surface.identityKey;
            root = { seen: true };
            slots = new WeakMap<object, Slot>();
            for (let index = 0; index < surface.messages.length; index += 1) {
                slot(surface.messages, index).seen = true;
            }
        }
        return surface;
    }

    function started(type: string, dryRun: boolean, streaming: boolean): void {
        if (dryRun || !['', 'normal', 'regenerate', 'swipe', 'continue'].includes(type)) {return;}
        const surface = baseline();
        active = surface
            ? { identity: surface.identityKey, streaming, sawText: false }
            : null;
    }

    function token(text: string): void {
        if (active && text.trim()) {active.sawText = true;}
    }

    function received(index: number, type: string): void {
        const request = active;
        const surface = capture();
        if (!request || !surface || surface.identityKey !== request.identity || identity !== surface.identityKey
            || !Number.isSafeInteger(index) || index < 0 || index >= surface.messages.length
            || !['', 'normal', 'regenerate', 'swipe', 'continue'].includes(type)) {return;}
        const message = surface.messages[index];
        if (!message || typeof message !== 'object' || storyMessageRole(message) !== 'assistant') {return;}
        const text = (message as { mes?: unknown }).mes;
        if (typeof text !== 'string' || !text.trim() || request.streaming && !request.sawText) {return;}
        const logicalSlot = slot(surface.messages, index);
        if (logicalSlot.seen) {return;}
        logicalSlot.seen = true;
        onNewFloor();
    }

    reset();
    return Object.freeze({ reset, started, token, received });
}
