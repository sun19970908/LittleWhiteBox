import { checkMarker } from '../domain/check-marker.js';
import { isCheckContinuationPoint, referencedActionChecks, type ActionCheckRecord } from '../domain/check-records.js';
import { parseActionCheck } from '../protocol/request.js';
import type { DiceHostMessage } from './message-records.js';
import { jsonValuesEqual } from '../../../host/json-values-equal.js';

/**
 * Native translation may still display the request that preceded a confirmed marker.
 * Project the confirmed pause without the request or its suffix; never write to the translation or prose.
 */
export function checkDisplayProjection(message: DiceHostMessage, checks: readonly ActionCheckRecord[]): string {
    const display = typeof message.extra?.display_text === 'string' ? message.extra.display_text : message.mes;
    const last = referencedActionChecks(message.mes, checks).at(-1);
    if (display === message.mes || !last || !isCheckContinuationPoint(message.mes, last)) { return display; }
    const request = parseActionCheck(display, 0, last.rule);
    return request.kind === 'request' && jsonValuesEqual(request.request, last.request)
        ? request.body + checkMarker(last.id) : display;
}
