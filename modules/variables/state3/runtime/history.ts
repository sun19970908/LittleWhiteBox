import { clone, equal } from '../engine/data.js';
import type { History, Json, Receipt, Success } from '../types.js';
import { createIdentifier } from '../../../../shared/common/identifier.js';
import { difference, applyDifference } from '../engine/difference.js';
import { displayChanges } from '../engine/delta-view.js';
import { retainEffects } from './rebase.js';
export { difference, applyDifference } from '../engine/difference.js';
export { digest } from '../definition/digest.js';

export const effectiveDelta = (receipt: Receipt) => Object.hasOwn(receipt, 'applied') ? receipt.applied! : receipt.delta;

export function makeReceipt({ before, result, revision, source = 'api' }: { before: Json; result: Success; revision: number; source?: string }): Receipt {
    return { id: createIdentifier(), revision, source, delta: difference(before, result.state),
        actions: result.actions.map(({ id }) => ({ id })) };
}

export function restore(state: Json, entries: Receipt[], reverse = false): Json {
    return (reverse ? [...entries].reverse() : entries).reduce((value, entry) => applyDifference(value, effectiveDelta(entry), reverse), clone(state));
}

/** A saved result describes that receipt, not the chat's current values. */
export function receiptResult(state: Json, receipt: Receipt): Success {
    return { ok: true, state, receipt, changes: displayChanges(effectiveDelta(receipt)), committed: true, saved: true,
        diagnostics: [], actions: clone(receipt.actions), provenance: [] };
}

/** Checkpoints accelerate a verified uninterrupted suffix only. */
export function rewind(history: History, state: Json, entries: Receipt[]): Json {
    const point = history.checkpoints.find(candidate => entries.length === history.revision - candidate.revision
        && entries.every((entry, index) => entry.revision === candidate.revision + index + 1));
    // Native panel/scripts can edit variables without making a 3.0 receipt.
    return point && equal(restore(point.state, entries), state) ? clone(point.state) : restore(state, entries, true);
}

export function checkpoint(history: History, state: Json, floor: number, revision = history.revision): void {
    const period = Math.floor((floor + 1) / 50);
    if (!period || history.checkpoints.some(point => Math.floor((point.floor + 1) / 50) >= period)) {return;}
    history.checkpoints = [...history.checkpoints,
        { floor, revision, state: clone(state) }].slice(-2);
}

/**
 * Keep confirmed later effects without rerunning rules. Only a changed starting
 * point needs a different reversible delta. Both deltas use the library format.
 */
export function rebase(state: Json, entries: Receipt[]): Json {
    let result = clone(state);
    for (const entry of entries) {
        const before = result;
        result = retainEffects(before, entry.delta);
        const applied = difference(before, result);
        if (equal(applied, entry.delta)) {delete entry.applied;} else {entry.applied = applied;}
    }
    return result;
}
