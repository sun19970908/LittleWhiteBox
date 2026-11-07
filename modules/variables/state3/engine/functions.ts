import type { Json } from '../types.js';
import { DEFAULT_TIMEOUT_MS, failure, runFunctionInVm, timeoutFor, type FunctionOptions } from './functions-vm.js';
export { FunctionExecutionError, runFunctionInVm } from './functions-vm.js';

/**
 * Browser entry: each call owns a module Worker, terminated on success, failure, or abort.
 * The VM timeout starts after WASM initialization; a separate startup watchdog also bounds
 * a failed/stalled worker. No worker, runtime, state or global survives a call.
 * Node callers use the same VM entry without a browser Worker (no timer-driven cancellation).
 */
export async function runFunction(options: FunctionOptions): Promise<Json> {
    const { id, signal } = options;
    if (typeof globalThis.Worker !== 'function') {
        if (typeof globalThis.window !== 'undefined') {throw failure('function_worker_unavailable', id);}
        return runFunctionInVm(options);
    }
    const timeout = timeoutFor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, id);
    if (signal?.aborted) {throw failure('function_aborted', id);}
    return new Promise<Json>((resolve, reject) => {
        let worker: Worker;
        try { worker = new Worker(new URL('./functions-worker.ts', import.meta.url), { type: 'module' }); }
        catch { reject(failure('function_worker_error', id)); return; }
        let timer: ReturnType<typeof setTimeout>;
        const finish = (error: Error | null, value?: Json) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            worker.terminate();
            if (error) {reject(error);}
            else {resolve(value!);}
        };
        const abort = () => finish(failure('function_aborted', id));
        signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => finish(failure('function_startup_timeout', id)), 10000);
        worker.onmessage = event => {
            if (event.data.type === 'ready') {
                clearTimeout(timer);
                // Guest execution has its own VM deadline. Message delivery and
                // main-thread scheduling are not guest CPU time (especially in
                // a background tab); this watchdog only catches a stuck worker.
                timer = setTimeout(() => finish(failure('function_timeout', id)), timeout + 1000);
                const request = { ...options };
                delete request.signal;
                try { worker.postMessage(request); }
                catch { finish(failure('function_invalid_input', id)); }
            } else if (event.data.error) {
                const { code, functionId, ...details } = event.data.error;
                finish(failure(code, functionId ?? id, details));
            } else {
                finish(null, event.data.value);
            }
        };
        worker.onerror = () => finish(failure('function_worker_error', id));
    });
}
