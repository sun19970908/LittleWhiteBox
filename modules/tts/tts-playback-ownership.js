/** One instance per TTS lifecycle. Bundled consumers obtain clients from the host facade. */
export function createTtsPlaybackOwnership() {
    const clients = new Set();
    let active = null;
    let closed = false;
    return {
        register(interrupt) {
            const entry = { interrupt };
            if (!closed) clients.add(entry);
            return {
                acquire(explicit = false) {
                    if (closed || !clients.has(entry)) return false;
                    if (active === entry) return true;
                    if (active && !explicit) return false;
                    const previous = active;
                    active = entry;
                    previous?.interrupt('interrupted');
                    return !closed && active === entry;
                },
                release() { if (active === entry) active = null; },
                dispose() {
                    if (active === entry) active = null;
                    clients.delete(entry);
                },
            };
        },
        dispose() {
            closed = true;
            active = null;
            const pending = [...clients];
            clients.clear();
            for (const client of pending) client.interrupt('disposed');
        },
    };
}
