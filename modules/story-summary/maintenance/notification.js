let listener = null;

export function registerMemoryMaintenance(listenerFunction) {
    listener = listenerFunction;
    return () => { if (listener === listenerFunction) listener = null; };
}

export function notifySummaryCommitted(batch) {
    listener?.(batch);
}
