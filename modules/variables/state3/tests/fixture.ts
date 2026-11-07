import assert from 'node:assert/strict';
import { createSettlementService } from '../runtime/service.js';
import { clone } from '../engine/data.js';
import type { History, HostAdapter, Result, Snapshot, SwipeRecord } from '../types.js';

export function accepted<T extends Result>(result: T): Extract<T, { ok: true }> {
    assert.ok(result.ok, JSON.stringify(result.diagnostics));
    return result as Extract<T, { ok: true }>;
}
export function fixture() {
    let history: History | undefined, records: SwipeRecord[] = [{ entries: [] }], identity = {};
    let saves = 0, notices = 0, saveFails = false;
    let saveGate: { started(): void; wait: Promise<void> } | undefined;
    interface TestSnapshot extends Snapshot { identity: object; revision?: number }
    const adapter: HostAdapter<TestSnapshot> = {
        capture(index = records.length - 1) { return { identity, history: clone(history), records: clone(records), index, revision: history?.revision, target: { floor: index, swipeId: 0 } }; },
        isCurrent(snapshot) { return snapshot.identity === identity && snapshot.revision === history?.revision; },
        publish(_snapshot, next) {
            history = clone(next.history); records = clone(next.records);
            return async () => {
                saves++;
                const gate = saveGate; saveGate = undefined;
                if (gate) { gate.started(); await gate.wait; }
                if (saveFails) {throw new Error('offline');}
            };
        },
        committed() { notices++; },
    };
    return { service: createSettlementService(adapter),
        saved: () => clone({ history, records }), counts: () => ({ saves, notices }),
        switch: () => { identity = {}; }, failSave: () => { saveFails = true; },
        holdNextSave() {
            let announce!: () => void, release!: () => void;
            const started = new Promise<void>(resolve => { announce = resolve; });
            const wait = new Promise<void>(resolve => { release = resolve; });
            saveGate = { started: announce, wait };
            return { started, release };
        },
        load(value: { history?: History; records: SwipeRecord[] }) { history = clone(value.history); records = clone(value.records); identity = {}; },
    };
}
