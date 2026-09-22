import { DICE_MESSAGE_KEY, isCheckContinuationPoint, parseDiceRecords } from '../domain/check-records.js';
import { findActionCheckStart } from '../protocol/markup.js';

/** Public message-level boundary; callers decide whether the message can still be continued. */
export function isDiceContinuationPending(message: { mes?: unknown; is_user?: boolean; extra?: Record<string, unknown> }): boolean {
    if (message.is_user || typeof message.mes !== 'string') { return false; }
    const body = message.mes;
    if (findActionCheckStart(body, 0) !== null) { return true; }
    const records = message.extra?.[DICE_MESSAGE_KEY];
    return records !== undefined && parseDiceRecords(records).checks.some(record => isCheckContinuationPoint(body, record));
}
