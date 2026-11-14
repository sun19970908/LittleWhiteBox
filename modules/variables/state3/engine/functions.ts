import type { Json } from '../types.js';
import { diagnostic } from './diagnostics.js';
import { failure, runFunctionInVm, type FunctionOptions } from './functions-vm.js';
export { FunctionExecutionError, runFunctionInVm } from './functions-vm.js';

const WATCHDOG_TICK_MS = 1000;
const UNRESPONSIVE_TICKS = 30;

/**
 * One settlement owns one lazy Worker/WASM. Each call owns a fresh guest VM.
 * Expressions await calls in order: this runner has no request queue.
 */
export function createFunctionRunner() {
    let worker: Worker | undefined, ready = false, closed = false;
    let waiting: { id: string; send(): void; finish(error: Error | null, value?: Json): void } | undefined;
    function destroy() {
        if (worker) {
            worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
            worker.terminate(); worker = undefined;
        }
        ready = false;
    }
    function startWorker() {
        worker = new Worker(new URL('./functions-worker.ts', import.meta.url), { type: 'module' });
        // These handlers belong to the runner, not to any call's input/state.
        worker.onmessage = event => {
            if (event.data.type === 'ready') { ready = true; waiting?.send(); }
            else if (event.data.error) {
                const { code, functionId, ...details } = event.data.error;
                waiting?.finish(failure(code, functionId ?? waiting.id, details));
            } else {waiting?.finish(null, event.data.value);}
        };
        worker.onerror = event => waiting?.finish(failure(ready ? 'function_worker_error' : 'function_startup_failed', waiting.id,
            { message: event.message, filename: event.filename, line: event.lineno, column: event.colno,
                ...(event.error ? { cause: diagnostic(event.error) } : {}) }));
        worker.onmessageerror = () => waiting?.finish(failure('function_message_error', waiting.id));
    }
    return {
        async run(options: FunctionOptions): Promise<Json> {
            const { id, signal } = options;
            if (closed || signal?.aborted) {throw failure('function_aborted', id);}
            if (waiting) {throw failure('function_busy', id);}
            if (typeof globalThis.Worker !== 'function') {
                if (typeof globalThis.window !== 'undefined') {throw failure('function_worker_unavailable', id);}
                return runFunctionInVm(options);
            }
            return new Promise<Json>((resolve, reject) => {
                let timer: ReturnType<typeof setInterval> | undefined, settled = false;
                let ticks = 0, lastTick = performance.now();
                const finish = (error: Error | null, value?: Json) => {
                    if (settled) {return;}
                    settled = true; clearInterval(timer);
                    signal?.removeEventListener('abort', abort);
                    waiting = undefined;
                    if (error) { destroy(); reject(error); }
                    else {resolve(value!);}
                };
                const abort = () => finish(failure('function_aborted', id));
                const send = () => {
                    ticks = 0; lastTick = performance.now();
                    const request = { ...options }; delete request.signal;
                    try { worker!.postMessage(request); }
                    catch (error) { finish(failure('function_message_error', id, { cause: diagnostic(error) })); }
                };
                waiting = { id, send, finish };
                signal?.addEventListener('abort', abort, { once: true });
                // Only continuous foreground waiting diagnoses an unresponsive
                // environment. A hidden or suspended page spends no allowance.
                timer = setInterval(() => {
                    const now = performance.now(), gap = now - lastTick; lastTick = now;
                    if (globalThis.document?.hidden || gap > WATCHDOG_TICK_MS * 2) { ticks = 0; return; }
                    if (++ticks >= UNRESPONSIVE_TICKS) {finish(failure(ready ? 'function_worker_unresponsive' : 'function_startup_failed', id));}
                }, WATCHDOG_TICK_MS);
                if (!worker) {
                    try { startWorker(); }
                    catch (error) { finish(failure('function_startup_failed', id, { cause: diagnostic(error) })); return; }
                } else if (ready) {send();}
            });
        },
        dispose() {
            closed = true;
            waiting?.finish(failure('function_aborted', ''));
            destroy();
        },
    };
}
