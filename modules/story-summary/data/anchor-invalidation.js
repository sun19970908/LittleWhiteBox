import { invalidateCompletionRanges } from '../maintenance/ranges.js';

/** Draft-only operation. Retirement lives and dies with its receipt, including deleted anchors. */
export function invalidateMemoryAnchors(snapshot, fromFloor = 0, reason = 'source_changed') {
    invalidateCompletionRanges(snapshot.storySummary.summaryHistory || [], [
        { from: fromFloor + 1, to: (snapshot.storySummary.lastSummarizedMesId ?? -1) + 1 },
    ]);
    const affected = atom => atom && atom.floor >= fromFloor;
    const ids = new Set(snapshot.stateAtoms.filter(affected).map(atom => atom.atomId));
    let retired = 0;
    for (const batch of snapshot.storySummary.summaryHistory || []) {
        for (const receipt of batch.maintenance || []) {
            for (const operation of receipt.operations) {
                for (const change of operation.changes) {
                    if (change.collection !== 'anchors' || change.retired || (!affected(change.before) && !affected(change.after))) continue;
                    ids.add(change.key);
                    change.retired = { reason, at: Date.now() };
                    retired++;
                }
            }
        }
    }
    snapshot.stateAtoms = snapshot.stateAtoms.filter(atom => !affected(atom));
    for (const floor of Object.keys(snapshot.l0Index.byFloor)) {
        if (Number(floor) >= fromFloor) delete snapshot.l0Index.byFloor[floor];
    }
    return { atomIds: [...ids], retired };
}

export function hasActiveAnchorHistoryFromFloor(store, fromFloor) {
    return (store?.summaryHistory || []).some(batch => (batch.maintenance || []).some(receipt =>
        receipt.operations.some(operation => operation.changes.some(change => change.collection === 'anchors'
            && !change.retired && [change.before, change.after].some(atom => atom && atom.floor >= fromFloor)))));
}

export function updateMaintainedAnchorIndex(snapshot, floors) {
    for (const floor of floors) {
        const count = snapshot.stateAtoms.filter(atom => atom.floor === floor).length;
        snapshot.l0Index.byFloor[String(floor)] = { ...snapshot.l0Index.byFloor[String(floor)],
            floor, status: count ? 'ok' : 'empty', atoms: count, updatedAt: Date.now() };
    }
}
