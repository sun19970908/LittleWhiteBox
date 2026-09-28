import type { PartitionStore } from '../../../kernel/contracts.js';
import { parseDiceRecords, type DiceMessageRecords } from '../domain/check-records.js';
import { applyResultOverride, checkBasis, type DiceResultOverride } from '../domain/result-override.js';
import type { DiceData } from '../partition.js';
import { DiceOperationError } from './operation-error.js';

/** The current result is shared by cards, action credentials and the D0 projection. */
export function createDiceResults(store: PartitionStore<DiceData>) {
    const current = new Map<string, DiceResultOverride>();
    const listeners = new Set<() => void>();
    const publish = () => { for (const listener of listeners) { listener(); } };
    // The store validates a snapshot on file changes. Card lookups must not parse/copy
    // the entire user partition again for every historical check on every repaint.
    let snapshot = store.peekCurrent();
    const unsubscribe = store.subscribe(next => {
        snapshot = next;
        for (const [id, local] of current) {
            // Only the exact observed version has left this page's responsibility.
            // An older completion must not remove a newer, still-unsaved roll.
            if (next.value?.resultOverrides[id]?.version === local.version) { current.delete(id); }
        }
        publish();
    });
    function entry(id: string) {
        const local = current.get(id);
        if (local) { return local; }
        if (!snapshot) { throw new DiceOperationError('dice_results_unavailable'); }
        const stored = snapshot.value?.resultOverrides;
        return stored && Object.hasOwn(stored, id) ? stored[id] : undefined;
    }
    return {
        records(raw: unknown): DiceMessageRecords | undefined {
            if (raw === undefined) { return undefined; }
            const parsed = parseDiceRecords(raw);
            return { ...parsed, checks: parsed.checks.map(record => applyResultOverride(record, entry(record.id))) };
        },
        version(raw: unknown): string {
            if (raw === undefined) { return ''; }
            return JSON.stringify(parseDiceRecords(raw).checks.map(record => {
                const saved = entry(record.id);
                return saved?.basis === checkBasis(record) ? saved.version : null;
            }));
        },
        apply(checkId: string, override: DiceResultOverride) {
            current.set(checkId, override);
            publish();
        },
        forget(checkIds: ReadonlySet<string>) {
            for (const id of checkIds) { current.delete(id); }
            publish();
        },
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        dispose() { unsubscribe(); current.clear(); listeners.clear(); },
    };
}
export type DiceResults = ReturnType<typeof createDiceResults>;
