import type { XiaobaiOsFileState } from '../../kernel/contracts.js';

export interface MaintenanceRootWriteGate {
    getState: () => XiaobaiOsFileState;
    subscribe: (listener: (state: XiaobaiOsFileState) => void) => () => void;
}

export const ALWAYS_READY_WRITE_GATE: MaintenanceRootWriteGate = Object.freeze({
    getState: () => 'ready',
    subscribe: () => () => undefined,
});

export function waitForMaintenanceWriteReady(options: {
    gate: MaintenanceRootWriteGate;
    signal: AbortSignal;
    guard: () => boolean;
}): Promise<boolean> {
    const { gate, signal, guard } = options;
    if (signal.aborted || !guard()) { return Promise.resolve(false); }
    if (gate.getState() === 'ready') { return Promise.resolve(true); }
    return new Promise<boolean>((resolve) => {
        let done = false;
        let unsubscribe: (() => void) | null = null;
        let unsubscribeAfterRegistration = false;
        const finish = (value: boolean): void => {
            if (done) { return; }
            done = true;
            if (unsubscribe) { unsubscribe(); } else { unsubscribeAfterRegistration = true; }
            signal.removeEventListener('abort', aborted);
            resolve(value);
        };
        const aborted = (): void => finish(false);
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) { finish(false); return; }
        const registered = gate.subscribe(() => {
            if (gate.getState() === 'ready') { finish(!signal.aborted && guard()); }
        });
        unsubscribe = registered;
        if (unsubscribeAfterRegistration) { registered(); }
        if (gate.getState() === 'ready') { finish(!signal.aborted && guard()); }
    });
}
