import assert from 'node:assert/strict';
import { createSettlementService } from '../runtime/service.js';
import { isOpeningReceipt } from '../runtime/history.js';
import { clone } from '../engine/data.js';
import type { Bundle, History, HostAdapter, Json, Result, Snapshot, SwipeRecord } from '../types.js';

export function accepted<T extends Result>(result: T): Extract<T, { ok: true }> {
    assert.ok(result.ok, JSON.stringify(result.diagnostics));
    return result as Extract<T, { ok: true }>;
}
export function fixture() {
    let card: Bundle;
    let state: Json = {}, history: History | undefined, records: SwipeRecord[] = [{ entries: [] }], identity = {};
    let saves = 0, notices = 0, saveFails = false;
    let saveGate: { started(): void; wait: Promise<void> } | undefined;
    interface TestSnapshot extends Snapshot { identity: object; revision?: number }
    const adapter: HostAdapter<TestSnapshot> = {
        bundle: () => clone(card),
        capture(index = records.length - 1) { return { identity, state: clone(state), history: clone(history), records: clone(records), opening: index === 0 && records.length === 1, lastReceiptIndex: records.reduce((last, record, floor) => record.entries.some(entry => !isOpeningReceipt(entry)) ? floor : last, -1), index, revision: history?.revision, target: { floor: index, swipeId: 0 } }; },
        isCurrent(snapshot) { return snapshot.identity === identity && snapshot.revision === history?.revision; },
        assertMutable(snapshot) {
            if (snapshot.index < Math.max(0, records.length - 2) || snapshot.index >= records.length) {throw { code: 'target-missing' };}
        },
        publish(_snapshot, next) {
            state = clone(next.state); history = clone(next.history); records = clone(next.records);
            return async () => {
                saves++;
                const gate = saveGate; saveGate = undefined;
                if (gate) { gate.started(); await gate.wait; }
                if (saveFails) {throw new Error('offline');}
            };
        },
        committed() { notices++; },
    };
    const service = createSettlementService(adapter);
    return { adapter, service: { ...service, enable: (bundle: Bundle) => { card = clone(bundle); return service.enable(); } },
        setCard(bundle: Bundle) { card = clone(bundle); identity = {}; },
        saved: () => clone({ state, history, records, card }), counts: () => ({ saves, notices }),
        switch: () => { identity = {}; }, failSave: () => { saveFails = true; },
        holdNextSave() {
            let announce!: () => void, release!: () => void;
            const started = new Promise<void>(resolve => { announce = resolve; });
            const wait = new Promise<void>(resolve => { release = resolve; });
            saveGate = { started: announce, wait };
            return { started, release };
        },
        load(value: { state: Json; history?: History; records: SwipeRecord[]; card?: Bundle }) { if (value.card) {card = clone(value.card);} state = clone(value.state); history = clone(value.history); records = clone(value.records); identity = {}; },
    };
}
