import { executeScript } from '../../../shared/common/script-execution.js';
import { JSAPI_ABORTED, JSAPI_CANCEL_NOTICE } from '../shared/jsapi-contract.js';

export async function executeJavaScriptApi(code, { ctx, st, signal, callbackCalls = [] }) {
    try {
        return await executeScript(code, { bindings: { ctx, st, getContext: () => ctx }, signal, callbackCalls,
            sourceName: 'lwb-assistant-script.js' });
    } catch (error) {
        if (error?.code === 'script-aborted') { error.code = JSAPI_ABORTED; error.message = JSAPI_CANCEL_NOTICE; }
        throw error;
    }
}
