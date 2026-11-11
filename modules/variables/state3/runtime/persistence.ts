interface PendingSave {
    owner: object;
    save(): Promise<void>;
    waiters: { resolve(): void; reject(error: unknown): void }[];
}

/** Serial disk writes; only not-yet-started saves for the same chat are coalesced. */
export function createSaveQueue() {
    const pending: PendingSave[] = [];
    let running: Promise<void> | undefined;
    async function drain() {
        while (pending.length) {
            const job = pending.shift()!;
            try {
                await job.save();
                for (const waiter of job.waiters) {waiter.resolve();}
            } catch (error) {
                for (const waiter of job.waiters) {waiter.reject(error);}
            }
        }
        running = undefined;
    }
    return (owner: object, save: () => Promise<void>): Promise<void> => {
        const result = new Promise<void>((resolve, reject) => {
            const queued = pending.find(job => job.owner === owner);
            if (queued) {
                queued.save = save;
                queued.waiters.push({ resolve, reject });
            } else {pending.push({ owner, save, waiters: [{ resolve, reject }] });}
        });
        running ??= Promise.resolve().then(drain);
        return result;
    };
}
