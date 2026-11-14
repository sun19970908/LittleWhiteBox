import type { Receipt, Snapshot, SwipeRecord } from '../types.js';
import { displayChanges } from '../engine/delta-view.js';
import { effectiveDelta, recordResult } from './history.js';
import { modelSource } from '../definition/stages.js';

export const beforeReceipt = (record?: SwipeRecord): Receipt | undefined => record?.entries.find(entry => entry.source === modelSource('before'));

export function beforeFloorOutcome(snapshot: Snapshot, index: number) {
    const result = recordResult(snapshot.state, snapshot.records, index);
    return result?.receipt?.beforeUpdate ? beforeOutcome(result.receipt) : undefined;
}

/** The same saved outcome feeds prose and the after updater. No second copy of state. */
export function beforeOutcome(receipt: Receipt) {
    return { outcome: receipt.beforeUpdate!.outcome, changes: displayChanges(effectiveDelta(receipt)),
        actions: receipt.actions, diagnostics: receipt.beforeUpdate!.diagnostics.map(issue => {
            const detail = { ...issue }; delete detail.actionTitle; return detail;
        }) };
}
