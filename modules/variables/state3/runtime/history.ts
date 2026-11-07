import { clone, equal, getAt, setAt } from '../engine/data.js';
import { reject } from '../engine/diagnostics.js';
import type { Delta, History, Json, Path, Receipt, Success } from '../types.js';
import { createIdentifier } from '../../../../shared/common/identifier.js';
export { digest } from '../definition/digest.js';

const object = (value: Json | undefined): value is Record<string, Json> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Outcomes only: restoring history never imports the compiler or settlement engine. */
export function difference(before: Json | undefined, after: Json | undefined, path: Path = []): Delta[] {
    if (equal(before, after)) {return [];}
    if (object(before) && object(after)) {
        return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => difference(before[key], after[key], [...path, key]));
    }
    if (Array.isArray(before) && Array.isArray(after)) {
        if (before.length === after.length) {return before.flatMap((item, index) => difference(item, after[index], [...path, String(index)]));}
        let head = 0, tail = 0;
        while (head < Math.min(before.length, after.length) && equal(before[head], after[head])) {head++;}
        while (tail < Math.min(before.length, after.length) - head && equal(before[before.length - 1 - tail], after[after.length - 1 - tail])) {tail++;}
        const oldMiddle = before.slice(head, before.length - tail), newMiddle = after.slice(head, after.length - tail);
        if (!oldMiddle.length || !newMiddle.length) {return [{ kind: 'splice', path, index: head, before: clone(oldMiddle), after: clone(newMiddle) }];}
        const count = Math.min(oldMiddle.length, newMiddle.length);
        const changes = oldMiddle.slice(0, count).flatMap((item, index) => difference(item, newMiddle[index], [...path, String(head + index)]));
        changes.push({ kind: 'splice', path, index: head + count, before: clone(oldMiddle.slice(count)), after: clone(newMiddle.slice(count)) });
        return changes;
    }
    return [{ kind: 'value', path, ...(before === undefined ? {} : { before: clone(before) }), ...(after === undefined ? {} : { after: clone(after) }) }];
}

export function applyDifference(state: Json, changes: Delta[], reverse = false): Json {
    return applyInPlace(clone(state), changes, reverse);
}

function applyInPlace(result: Json, changes: Delta[], reverse: boolean): Json {
    for (const change of reverse ? [...changes].reverse() : changes) {
        const value = reverse ? change.before : change.after;
        if (change.kind === 'splice') {
            const array = getAt(result, change.path);
            if (!Array.isArray(array)) {reject('history-format', { path: change.path });}
            array.splice(change.index, (reverse ? change.after : change.before).length, ...clone(value as Json[]));
        } else if (!change.path.length) {
            if (value === undefined) {reject('history-format');}
            result = clone(value);
        } else {setAt(result, change.path, value, value === undefined);}
    }
    return result;
}

export function makeReceipt({ before, result, revision, source = 'api' }: { before: Json; result: Success; revision: number; source?: string }): Receipt {
    const changes = difference(before, result.state);
    for (const change of changes) {
        const provenance = [...result.provenance].reverse().find(item => item.path.every((part, index) => part === change.path[index]));
        if (provenance) {change.source = provenance.source;}
    }
    return { id: createIdentifier(), revision, source, changes, actions: result.actions.map(({ id }) => ({ id })) };
}

export function restore(state: Json, entries: Receipt[], reverse = false): Json {
    return (reverse ? [...entries].reverse() : entries).reduce((value, entry) => applyInPlace(value, entry.changes, reverse), clone(state));
}

/** A saved result describes that receipt, not the chat's current values. */
export function receiptResult(state: Json, receipt: Receipt): Success {
    const changes = receipt.changes.map(change => ({ path: clone(change.path), before: clone(change.before), after: clone(change.after),
        removed: change.after === undefined, ...(change.kind === 'splice' ? { index: change.index } : {}) }));
    return { ok: true, state, receipt, changes, committed: true, saved: true, diagnostics: [], actions: clone(receipt.actions),
        provenance: changes.flatMap((change, index) => receipt.changes[index].source ? [{ ...change, source: receipt.changes[index].source! }] : []) };
}

/**
 * Checkpoints accelerate an uninterrupted suffix only. Missing/moved records
 * simply use reversible effects; they never invalidate the saved current state.
 */
export function rewind(history: History, entries: Receipt[]): Json {
    const point = history.checkpoints.find(candidate => entries.length === history.revision - candidate.revision
        && entries.every((entry, index) => entry.revision === candidate.revision + index + 1));
    return point ? clone(point.state) : restore(history.state, entries, true);
}

export function checkpoint(history: History, floor: number, revision = history.revision): void {
    const period = Math.floor((floor + 1) / 50);
    if (!period || history.checkpoints.some(point => Math.floor((point.floor + 1) / 50) >= period)) {return;}
    history.checkpoints = [...history.checkpoints,
        { floor, revision, state: clone(history.state) }].slice(-2);
}
