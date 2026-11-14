import { analyzeJavaScriptApiRequest } from './jsapi-analysis.js';
import { executeJavaScriptApi } from './jsapi-execution.js';
import { JSAPI_ABORTED, JSAPI_CANCEL_NOTICE } from '../shared/jsapi-contract.js';
import { normalizeJavaScriptApiOutput } from './jsapi-output.js';
import { errorDetails } from '../../../shared/common/error-details.js';

export { analyzeJavaScriptApiRequest } from './jsapi-analysis.js';

export async function runJavaScriptApi({ code = '', purpose = '', expectedOutput = '', manifest = {}, ctx = {}, st = {}, signal } = {}) {
    code = String(code).trim();
    const analysis = analyzeJavaScriptApiRequest({ code, manifest });
    const { requestKind, usedApis, calledApis, calledApiSemantics, validationErrors } = analysis;
    const receipt = (ok, fields = {}, execution = {}) => ({
        code, ok, output: '', note: '', requestKind, usedApis, calledApis, calledApiSemantics,
        execution: { isError: !ok, errorCode: '', errorMessage: '', isAborted: false, abortReason: '',
            unavailableApis: [], validationErrors: [], ...execution }, ...fields,
    });
    const missing = Object.entries({ code, purpose, expectedOutput }).filter(([, value]) => !String(value).trim()).map(([name]) => name);
    if (missing.length || validationErrors.length) {
        return receipt(false, {}, { errorCode: 'jsapi_validation_failed',
            validationErrors: [...(missing.length ? [`Missing fields: ${missing.join(', ')}`] : []), ...validationErrors] });
    }
    try {
        const { result, missingReturn } = await executeJavaScriptApi(code, { ctx, st, signal, callbackCalls: analysis.callbackCalls });
        if (missingReturn) return receipt(false, { note: 'The script ran but reached its end without returning a result. Earlier operations may have completed; inspect their outcome before retrying.' },
            { errorCode: 'jsapi_result_missing', errorMessage: 'The executed branch did not return a result.' });
        return receipt(true, normalizeJavaScriptApiOutput(result, requestKind));
    } catch (error) {
        const aborted = error?.code === JSAPI_ABORTED;
        return receipt(false, { note: aborted ? JSAPI_CANCEL_NOTICE : '' }, { isAborted: aborted,
            errorCode: aborted ? JSAPI_ABORTED : 'jsapi_execution_failed', errorMessage: error?.message || String(error),
            errorStack: error?.stack || '', error: errorDetails(error), abortReason: aborted ? JSAPI_CANCEL_NOTICE : '' });
    }
}
