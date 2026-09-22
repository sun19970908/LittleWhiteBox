import { createAbortError, throwIfSignalAborted } from '../../../shared/common/abort-utils.js';
import { createRecallDiagnostics } from '../recall-diagnostics.js';
import { RECALL_TIMEOUT_MS, RECALL_TIMEOUT_REASONS } from './recall-failure.js';

const DEFAULT_POLL_MS = 16;

export function getRecallPrefetchStartAction(type, params, isDryRun) {
    if (isDryRun) return 'ignore';
    const normalizedType = type || 'normal';
    if (normalizedType !== 'normal' || params?.automatic_trigger) return 'cancel-only';
    return 'watch';
}

function settle(promise) {
    return Promise.resolve(promise).then(
        value => ({ ok: true, value }),
        error => ({ ok: false, error }),
    );
}

/**
 * Owns the one transient Story Summary recall run that may exist for a host
 * generation. It never owns Prompt state; the generate interceptor remains the
 * only place allowed to publish a prepared result.
 */
export function createRecallPrefetchCoordinator(options) {
    if (typeof options?.getContext !== 'function') throw new TypeError('getContext must be a function');
    if (typeof options?.prepare !== 'function') throw new TypeError('prepare must be a function');

    const getContext = options.getContext;
    const prepare = options.prepare;
    const pollMs = Math.max(0, Number(options.pollMs) || DEFAULT_POLL_MS);
    const maxAgeMs = Math.max(1, Number(options.maxAgeMs) || RECALL_TIMEOUT_MS);
    const schedule = options.setTimeout || globalThis.setTimeout.bind(globalThis);
    const unschedule = options.clearTimeout || globalThis.clearTimeout.bind(globalThis);
    const now = options.now || (() => performance.now());

    let current = null;

    function clearTimers(slot) {
        if (slot.pollTimer !== null) {
            unschedule(slot.pollTimer);
            slot.pollTimer = null;
        }
        if (slot.expiryTimer !== null) {
            unschedule(slot.expiryTimer);
            slot.expiryTimer = null;
        }
    }

    function clearPollTimer(slot) {
        if (slot.pollTimer === null) return;
        unschedule(slot.pollTimer);
        slot.pollTimer = null;
    }

    function detachDispatch(slot) {
        slot.dispatchSignal?.removeEventListener?.('abort', slot.abortFromDispatch);
        slot.dispatchSignal = null;
        slot.abortFromDispatch = null;
    }

    function detachSource(slot) {
        slot.sourceSignal?.removeEventListener?.('abort', slot.abortFromSource);
        slot.sourceSignal = null;
        slot.abortFromSource = null;
    }

    function abortSlot(slot, reason, abortDispatch = false, retainForJoin = false) {
        if (!slot || slot.phase === 'idle') return;
        if (slot.phase === 'cancelled') {
            if (retainForJoin) slot.cancelReason = reason;
            else if (current === slot) current = null;
            return;
        }
        slot.cancelReason = reason;
        slot.phase = 'cancelled';
        slot.diagnostics.finishedAt ??= now();
        clearTimers(slot);
        detachDispatch(slot);
        detachSource(slot);
        if (abortDispatch) slot.runContext?.abort?.(true);
        if (!slot.controller.signal.aborted) {
            slot.controller.abort(createAbortError(`Story Summary recall ${reason}`));
        }
        if (!retainForJoin && current === slot) current = null;
        if (slot.joinedAt !== null) options.onJoinedCancel?.(slot);
    }

    function expireSlot(slot) {
        if (slot.phase === 'ready') return;
        abortSlot(slot, slot.computeStartedAt === null ? RECALL_TIMEOUT_REASONS.host : RECALL_TIMEOUT_REASONS.compute, false, true);
    }

    function scheduleExpiry(slot) {
        const delay = Math.max(0, slot.deadlineAt - now());
        slot.expiryTimer = schedule(() => {
            slot.expiryTimer = null;
            expireSlot(slot);
        }, delay);
    }

    function startCompute(slot) {
        if (slot.outcome) return;
        clearTimers(slot);
        slot.computeStartedAt = now();
        // Watching for a USER message consumes no recall computation budget.
        slot.deadlineAt = slot.computeStartedAt + maxAgeMs;
        slot.diagnostics.startedAt = now();
        slot.diagnostics.stage = 'prepare';
        scheduleExpiry(slot);
        slot.outcome = settle(Promise.resolve().then(() => {
            if (slot.controller.signal.aborted) {
                throw slot.controller.signal.reason || createAbortError('Story Summary recall cancelled');
            }
            return prepare(slot.type, slot.controller.signal, slot.diagnostics);
        })).then(outcome => {
            // Both success and failure are final outcomes. A late host join must
            // neither expire a finished result nor replace its original error.
            if (slot.phase !== 'cancelled' && slot.phase !== 'idle') {
                if (now() >= slot.deadlineAt) {
                    expireSlot(slot);
                } else {
                    slot.phase = 'ready';
                    slot.diagnostics.finishedAt ??= now();
                    clearTimers(slot);
                }
            }
            return outcome;
        });
    }

    function schedulePoll(slot) {
        slot.pollTimer = schedule(() => {
            slot.pollTimer = null;
            if (current !== slot || slot.phase !== 'watching') return;

            const context = getContext();
            const chat = context?.chat;
            if (String(context?.chatId || '') !== slot.chatId || !Array.isArray(chat)) {
                abortSlot(slot, 'chat-changed');
                return;
            }

            const messageIndex = chat.length - 1;
            const message = chat[messageIndex];
            if (chat.length > slot.initialLength && message?.is_user === true) {
                slot.messageIndex = messageIndex;
                slot.capturedRef = message;
                slot.phase = 'recalling';
                startCompute(slot);
                return;
            }

            schedulePoll(slot);
        }, pollMs);
    }

    function createSlot({ chatId, type, initialLength, phase }) {
        return {
            phase,
            chatId,
            type,
            initialLength,
            messageIndex: null,
            capturedRef: null,
            controller: new AbortController(),
            diagnostics: {
                ...createRecallDiagnostics(chatId, type),
                startedAt: now(),
                stage: phase === 'watching' ? 'waiting-for-user' : 'prepare',
            },
            outcome: null,
            pollTimer: null,
            expiryTimer: null,
            runContext: null,
            dispatchSignal: null,
            abortFromDispatch: null,
            sourceSignal: null,
            abortFromSource: null,
            cancelReason: null,
            computeStartedAt: null,
            joinedAt: null,
            deadlineAt: now() + maxAgeMs,
        };
    }

    function attachSource(slot, signal) {
        if (!signal?.addEventListener) return;

        const abortFromSource = () => {
            abortSlot(slot, 'generation-signal-aborted', false, true);
        };
        slot.sourceSignal = signal;
        slot.abortFromSource = abortFromSource;
        signal.addEventListener('abort', abortFromSource, { once: true });
        if (signal.aborted) abortFromSource();
    }

    function attachDispatch(slot, runContext) {
        slot.runContext = runContext || null;
        const signal = runContext?.signal;
        if (!signal) return;

        const abortFromDispatch = () => abortSlot(slot, 'dispatch-aborted');
        slot.dispatchSignal = signal;
        slot.abortFromDispatch = abortFromDispatch;
        signal.addEventListener('abort', abortFromDispatch, { once: true });
        if (signal.aborted) abortFromDispatch();
    }

    function startWatching({ chatId, type = 'normal', initialLength, signal = null }) {
        if (!chatId) return null;
        if (current) abortSlot(current, 'superseded', true);

        const slot = createSlot({
            chatId: String(chatId),
            type,
            initialLength: Math.max(0, Number(initialLength) || 0),
            phase: 'watching',
        });
        current = slot;
        attachSource(slot, signal);
        if (slot.controller.signal.aborted) return slot;
        scheduleExpiry(slot);
        schedulePoll(slot);
        return slot;
    }

    function startJoined({
        chatId,
        type,
        focusRef,
        runContext,
        sourceSignal = null,
    }) {
        const context = getContext();
        const chat = Array.isArray(context?.chat) ? context.chat : [];
        const slot = createSlot({
            chatId: String(chatId || ''),
            type,
            initialLength: chat.length,
            phase: 'joined',
        });
        slot.joinedAt = now();
        slot.messageIndex = focusRef ? chat.lastIndexOf(focusRef) : null;
        slot.capturedRef = focusRef || null;
        current = slot;
        attachSource(slot, sourceSignal);
        if (!slot.controller.signal.aborted) attachDispatch(slot, runContext);
        if (!slot.controller.signal.aborted) {
            startCompute(slot);
        }
        return { slot, path: 'fallback' };
    }

    function join({ chatId, type, focusRef, runContext }) {
        const slot = current;
        const context = getContext();
        const chat = Array.isArray(context?.chat) ? context.chat : [];
        const focusIndex = chat.length - 1;
        const sameChat = !!slot
            && slot.chatId === String(chatId || '')
            && String(context?.chatId || '') === slot.chatId;
        const terminalMatches = sameChat
            && slot.phase === 'cancelled'
            && (slot.type === null || slot.type === type);
        const sameGeneration = !!slot
            && slot.type === 'normal'
            && type === 'normal'
            && sameChat;

        if (sameGeneration && now() >= slot.deadlineAt && !['cancelled', 'ready'].includes(slot.phase)) {
            expireSlot(slot);
        }
        if (terminalMatches || (sameGeneration && slot.phase === 'cancelled')) {
            const wasJoined = slot.joinedAt !== null;
            slot.joinedAt = now();
            // A cancellation before join belongs to this generation too. Notify
            // its single report owner when consumed, never again in the catch path.
            if (!wasJoined) options.onJoinedCancel?.(slot);
            return {
                slot,
                path: slot.cancelReason || 'cancelled',
            };
        }

        const canReuse = !!slot
            && sameGeneration
            && slot.capturedRef
            && slot.capturedRef === focusRef
            && slot.messageIndex === focusIndex
            && chat[slot.messageIndex] === slot.capturedRef;

        if (!canReuse) {
            const sourceSignal = sameGeneration ? slot?.sourceSignal : null;
            if (slot) abortSlot(slot, 'prefetch-mismatch', true);
            return startJoined({
                chatId,
                type,
                focusRef,
                runContext,
                sourceSignal,
            });
        }

        clearPollTimer(slot);
        if (slot.phase !== 'ready') slot.phase = 'joined';
        slot.joinedAt = now();
        attachDispatch(slot, runContext);
        return {
            slot,
            path: 'prefetch',
        };
    }

    async function waitForOutcome(slot) {
        const signal = slot.controller.signal;
        throwIfSignalAborted(signal);
        let onAbort;
        const cancelled = new Promise((_, reject) => {
            onAbort = () => reject(signal.reason);
            signal.addEventListener('abort', onAbort, { once: true });
        });
        try {
            // The coordinator owns the only deadline. Waiting must still end
            // immediately if prepare ignores cancellation or never settles.
            const outcome = await Promise.race([slot.outcome, cancelled]);
            throwIfSignalAborted(signal);
            return outcome;
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
    }

    function cancel(reason = 'cancelled', options = {}) {
        const {
            abortDispatch = false,
            retainForJoin = false,
            chatId = null,
            type = null,
        } = options;
        const targetChatId = chatId ? String(chatId) : null;
        if (current && retainForJoin && targetChatId && current.chatId !== targetChatId) {
            abortSlot(current, reason, abortDispatch);
        }
        if (!current && retainForJoin && chatId) {
            current = createSlot({
                chatId: targetChatId,
                type,
                initialLength: 0,
                phase: 'watching',
            });
        }
        if (!current) return null;
        const slot = current;
        abortSlot(slot, reason, abortDispatch, retainForJoin);
        return slot;
    }

    function finish(slot) {
        if (!slot) return;
        clearTimers(slot);
        detachDispatch(slot);
        detachSource(slot);
        if (current === slot) current = null;
        slot.phase = 'idle';
    }

    return Object.freeze({
        startWatching,
        join,
        waitForOutcome,
        cancel,
        finish,
        getCurrent: () => current,
    });
}
