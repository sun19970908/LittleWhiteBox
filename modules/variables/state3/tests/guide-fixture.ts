import { createSettlementService } from '../runtime/service.js';
import { isOpeningReceipt } from '../runtime/history.js';
import type { ExtensionHost } from '../extensions/runtime.js';
import type { Bundle, History, HostAdapter, Json, Result, SwipeRecord } from '../types.js';

// Isolated host for the published guide panel in DOM and browser acceptance.
// Settlement and restoration use the real service; only storage/host APIs are simulated.
export async function createGuideFixture(bundle: Bundle, extensionHost?: ExtensionHost) {
    let state: Json = {}, history: History | undefined, records: SwipeRecord[] = [{ entries: [] }];
    let lastResult: Result | undefined, save: (() => Promise<void>) | undefined;
    let persisted: { state: Json; history: History; records: SwipeRecord[] } | undefined;
    const controls = { offline: false, applyCalls: 0, retryCalls: 0, saves: 0, chatId: 'guide-a', readError: false, unavailable: false };
    let gate: Promise<void> | undefined;
    const adapter: HostAdapter = {
        bundle: () => bundle,
        capture(index = records.length - 1) {
            return structuredClone({ state, history, records, opening: index === 0 && records.length === 1,
                lastReceiptIndex: records.reduce((last, record, floor) => record.entries.some(entry => !isOpeningReceipt(entry)) ? floor : last, -1),
                index, target: { floor: index, swipeId: 0 } });
        },
        isCurrent: snapshot => snapshot.history?.revision === history?.revision,
        assertMutable(snapshot) { if (snapshot.index !== records.length - 1) {throw { code: 'target-missing' };} },
        publish(_snapshot, next) {
            ({ state, history, records } = structuredClone(next));
            save = async () => {
                const wait = gate; gate = undefined;
                if (wait) {await wait;}
                controls.saves++;
                if (controls.offline) {throw new Error('Test storage offline');}
                persisted = structuredClone({ state, history: history!, records });
            };
            return save;
        },
    };
    const service = createSettlementService(adapter, extensionHost);
    const retain = async (work: Promise<Result>) => { lastResult = await work; return lastResult; };
    await retain(service.enable());
    const ctx = {
        get chatId() { return controls.chatId; },
        variables: { local: { get(root: string) {
            if (controls.readError) {throw new Error('Test read unavailable');}
            const value = (state as Record<string, Json>)[root];
            return value === undefined ? '' : JSON.stringify(value);
        } } },
    };
    const api = {
        apply(input: unknown) {
            controls.applyCalls++;
            if (controls.unavailable) {throw Object.assign(new Error('Generation in progress'), { code: 'commit-busy' });}
            // VM execution is another realm, like a real iframe.
            return retain(service.apply(JSON.parse(JSON.stringify(input))));
        },
        lastResult: () => lastResult,
        async retrySave() {
            controls.retryCalls++;
            await save!();
            if (lastResult?.ok) {lastResult = { ...lastResult, saved: true };}
            return { ok: true, saved: true };
        },
    };
    return {
        host: { SillyTavern: { getContext: () => ctx }, LWB_StateV3: api }, controls, service,
        state: () => structuredClone(state), records: () => structuredClone(records),
        external(value: Json) { state = structuredClone(value); },
        async undo() { return retain(service.undo()); },
        reopen() {
            if (!persisted) {throw new Error('No saved state');}
            ({ state, history, records } = structuredClone(persisted));
            lastResult = undefined;
        },
        holdSave() {
            let release!: () => void;
            gate = new Promise<void>(resolve => { release = resolve; });
            return release;
        },
    };
}
