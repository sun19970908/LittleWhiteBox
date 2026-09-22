import { isL0FloorDeferred } from './l0-eligibility.js';

/** One replaceable timer. Continuation or a new floor re-admits deferred work. */
export function createVectorMaintenanceScheduler({ getContext, isStale, getQuietWaitMs, run }) {
    let timer = null;
    function clear() {
        clearTimeout(timer);
        timer = null;
    }
    function schedule(delayMs, chatIdOverride = null) {
        clear();
        const { chatId, chat = [] } = getContext();
        const scheduledChatId = chatIdOverride || chatId;
        if (isStale(scheduledChatId) || isL0FloorDeferred(chat)) return;
        timer = setTimeout(() => {
            timer = null;
            if (isStale(scheduledChatId) || isL0FloorDeferred(getContext().chat || [])) return;
            const quietWait = getQuietWaitMs();
            if (quietWait > 0) {
                schedule(quietWait, scheduledChatId);
                return;
            }
            run(scheduledChatId);
        }, delayMs);
    }
    return { schedule, clear };
}
