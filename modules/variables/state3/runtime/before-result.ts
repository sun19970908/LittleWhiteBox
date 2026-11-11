import type { Receipt, SwipeRecord } from '../types.js';
import { displayChanges } from '../engine/delta-view.js';
import { effectiveDelta } from './history.js';
import { modelSource } from '../definition/stages.js';

export const beforeReceipt = (record?: SwipeRecord): Receipt | undefined => record?.entries.find(entry => entry.source === modelSource('before'));

/** The same saved outcome feeds prose and the after updater. No second copy of state. */
export function beforeOutcome(receipt: Receipt) {
    return { outcome: receipt.beforeUpdate!.outcome, changes: displayChanges(effectiveDelta(receipt)),
        actions: receipt.actions, diagnostics: receipt.beforeUpdate!.diagnostics.map(issue => {
            const detail = { ...issue }; delete detail.actionTitle; return detail;
        }) };
}
