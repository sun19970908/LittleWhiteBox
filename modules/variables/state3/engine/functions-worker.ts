import { diagnostic } from './diagnostics.js';
import { initializeFunctionVm, runFunctionInVm, type FunctionOptions } from './functions-vm.js';

void initializeFunctionVm().then(
    () => self.postMessage({ type: 'ready' }),
    error => self.postMessage({ type: 'result', error: { code: 'function_startup_failed', cause: diagnostic(error) } }),
);
self.onmessage = async (event: MessageEvent<FunctionOptions>) => {
    try {
        const value = await runFunctionInVm(event.data);
        self.postMessage({ type: 'result', value });
    } catch (error) {
        self.postMessage({ type: 'result', error: { ...diagnostic(error), functionId: event.data.id } });
    }
};
