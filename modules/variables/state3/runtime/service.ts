import { compileDefinition } from '../definition/compile.js';
import { clone, changes } from '../engine/data.js';
import { initialize, settle } from '../engine/settle.js';
import { reject } from '../engine/diagnostics.js';
import { checkpoint, digest, makeReceipt, restore, rewind } from './history.js';
import type { Bundle, History, HostAdapter, Receipt, Result, RunOptions, Snapshot, Success, SwipeRecord } from '../types.js';

interface StageOptions extends RunOptions { index?: number; replaceSource?: string }
interface ApplyOptions extends StageOptions { preview?: boolean; source?: string; bundle?: Bundle }
const success = (state: History['state']): Success => ({ ok: true, state, changes: [], provenance: [], actions: [], diagnostics: [] });

export function createSettlementService<S extends Snapshot>(adapter: HostAdapter<S>) {
    const assertCurrent = (snapshot: S) => { if (!adapter.isCurrent(snapshot)) {reject('stale-target');} };
    async function publish(snapshot: S, history: History, records: SwipeRecord[], result: Success, notify: boolean): Promise<Success> {
        assertCurrent(snapshot);
        // Validation and publication are synchronous. Only persistence may wait;
        // another selection must be able to restore this state while it waits.
        history.revision++;
        const save = adapter.publish(snapshot, { history, records });
        let persistence: Success['persistence'];
        try { await save(); }
        catch (error) { persistence = { code: 'save-unconfirmed', message: error instanceof Error ? error.message : String(error) }; }
        const published = { ...result, committed: true, saved: !persistence, ...(persistence ? { persistence } : {}) };
        if (notify) {
            try { adapter.committed?.(published); }
            catch (error) { published.diagnostics.push({ code: 'notification-failed', message: error instanceof Error ? error.message : String(error) }); }
        }
        return published;
    }
    async function stage({ index, replaceSource, signal }: StageOptions = {}) {
        const snapshot = adapter.capture(index), history = snapshot.history;
        if (!history) {reject('not-enabled');}
        const records = clone(snapshot.records), target = records[snapshot.index];
        if (!target) {reject('target-missing');}
        const replaces = (entry: Receipt) => Boolean(replaceSource && (['body', 'model'].includes(replaceSource) ? ['body', 'model'].includes(entry.source) : entry.source === replaceSource));
        const insertion = replaceSource ? target.entries.findIndex(replaces) : -1;
        const position = insertion < 0 ? target.entries.length : insertion;
        const suffix = [...target.entries.slice(position), ...records.slice(snapshot.index + 1).flatMap(record => record.entries)];
        const start = rewind(history, suffix);
        assertCurrent(snapshot);
        let consumed = false;
        return {
            ok: true as const, snapshot: clone(start), bundle: clone(history.bundle), target: snapshot.target,
            assertCurrent: () => assertCurrent(snapshot),
            async run(input: unknown, { preview = true, source = 'api', bundle, signal: runSignal }: ApplyOptions = {}): Promise<Result> {
                if (consumed) {reject('stage-consumed');}
                assertCurrent(snapshot);
                const compiled = compileDefinition(bundle || history.bundle);
                const result = await settle(compiled, start, input, { signal: runSignal || signal });
                if (!result.ok) {return result;}
                const receipt = makeReceipt({ before: start, result, source, revision: history.revision + 1 });
                const next = clone(records);
                const retained = target.entries.slice(position).filter(entry => !replaces(entry));
                next[snapshot.index].entries = [...target.entries.slice(0, position), receipt, ...retained];
                const state = restore(result.state, [...retained, ...next.slice(snapshot.index + 1).flatMap(record => record.entries)]);
                const updated: History = { ...clone(history), state, bundle: clone(compiled.bundle), version: digest(compiled.bundle) };
                assertCurrent(snapshot); (runSignal || signal)?.throwIfAborted();
                if (preview) {return { ...result, committed: false };}
                consumed = true;
                // A point is the saved end state, not the earlier insertion point.
                if (snapshot.index === records.length - 1) {checkpoint(updated, snapshot.index, updated.revision + 1);}
                return publish(snapshot, updated, next, { ...result, state, version: updated.version, receipt }, true);
            },
        };
    }
    return {
        stage,
        async inspect() {
            const snapshot = adapter.capture();
            if (!snapshot.history) {return { ok: false as const, diagnostics: [{ code: 'not-enabled' }] };}
            return { ...success(clone(snapshot.history.state)), version: snapshot.history.version, bundle: clone(snapshot.history.bundle),
                receipt: snapshot.records[snapshot.index]?.entries.at(-1) };
        },
        async enable(bundle: Bundle, { signal }: RunOptions = {}): Promise<Result> {
            const snapshot = adapter.capture();
            if (snapshot.history) {reject('already-enabled');}
            const compiled = compileDefinition(bundle), result = await initialize(compiled, { signal });
            if (!result.ok) {return result;}
            signal?.throwIfAborted();
            const history: History = { format: 2, bundle: clone(compiled.bundle), version: digest(compiled.bundle), state: clone(result.state), revision: 0, checkpoints: [] };
            return publish(snapshot, history, snapshot.records, { ...result, version: history.version }, false);
        },
        async apply(input: unknown, options: ApplyOptions = {}) {
            const staged = await stage({ ...options, replaceSource: options.replaceSource ?? (['body', 'model'].includes(options.source || '') ? options.source : undefined) });
            return staged.run(input, { ...options, preview: false });
        },
        async preview(input: unknown, options: ApplyOptions = {}) {
            const staged = await stage({ ...options, replaceSource: options.replaceSource ?? (['body', 'model'].includes(options.source || '') ? options.source : undefined) });
            return staged.run(input, { ...options, preview: true });
        },
        async undo({ index, signal, all = false }: RunOptions & { index?: number; all?: boolean } = {}): Promise<Result> {
            const snapshot = adapter.capture(index), history = snapshot.history, records = clone(snapshot.records);
            if (!history || !records[snapshot.index]?.entries.length) {reject('nothing-to-undo');}
            const target = records[snapshot.index], later = records.slice(snapshot.index + 1).flatMap(record => record.entries);
            const removed = all ? target.entries.splice(0) : target.entries.splice(-1);
            const state = restore(rewind(history, [...removed, ...later]), later);
            signal?.throwIfAborted();
            return publish(snapshot, { ...clone(history), state, checkpoints: [] }, records,
                { ...success(state), changes: changes(history.state, state), version: history.version }, true);
        },
        async restoreSelection(previous: Receipt[], next: Receipt[] = []): Promise<Result | undefined> {
            const snapshot = adapter.capture(), history = snapshot.history;
            if (!history || (!previous.length && !next.length)) {return;}
            const state = restore(rewind(history, previous), next);
            return publish(snapshot, { ...clone(history), state, checkpoints: [] }, snapshot.records,
                { ...success(state), changes: changes(history.state, state), version: history.version }, true);
        },
    };
}
export type SettlementService = ReturnType<typeof createSettlementService>;
