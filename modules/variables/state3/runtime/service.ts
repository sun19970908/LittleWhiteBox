import { compileDefinition } from '../definition/compile.js';
import { clone } from '../engine/data.js';
import { difference } from '../engine/difference.js';
import { displayChanges } from '../engine/delta-view.js';
import { settle } from '../engine/settle.js';
import { variableRoots } from './variables.js';
import { reject } from '../engine/diagnostics.js';
import { checkpoint, digest, makeReceipt, rebase, rewind } from './history.js';
import type { History, HostAdapter, Json, JsonObject, Receipt, Result, RunOptions, Snapshot, Success, SwipeRecord } from '../types.js';

interface StageOptions extends RunOptions { index?: number; replaceSource?: string }
interface ApplyOptions extends StageOptions { preview?: boolean; source?: string }
const success = (state: Json): Success => ({ ok: true, state, changes: [], provenance: [], actions: [], diagnostics: [] });

export function createSettlementService<S extends Snapshot>(adapter: HostAdapter<S>) {
    const assertCurrent = (snapshot: S) => { if (!adapter.isCurrent(snapshot)) {reject('stale-target');} };
    async function publish(snapshot: S, history: History, records: SwipeRecord[], result: Success, notify: boolean): Promise<Success> {
        assertCurrent(snapshot);
        // Validation and publication are synchronous. Only persistence may wait;
        // another selection must be able to restore this state while it waits.
        history.revision++;
        const save = adapter.publish(snapshot, { state: result.state, history, records });
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
        const compiled = compileDefinition(adapter.bundle());
        if (!history) {reject('not-enabled');}
        const records = clone(snapshot.records), target = records[snapshot.index];
        if (!target) {reject('target-missing');}
        const replaces = (entry: Receipt) => Boolean(replaceSource && (['body', 'model'].includes(replaceSource) ? ['body', 'model'].includes(entry.source) : entry.source === replaceSource));
        const insertion = replaceSource ? target.entries.findIndex(replaces) : -1;
        const position = insertion < 0 ? target.entries.length : insertion;
        const suffix = [...target.entries.slice(position), ...records.slice(snapshot.index + 1).flatMap(record => record.entries)];
        const start = rewind(history, snapshot.state, suffix);
        assertCurrent(snapshot);
        let consumed = false;
        return {
            ok: true as const, snapshot: clone(start), bundle: clone(compiled.bundle), roots: clone(history.roots), target: snapshot.target,
            assertCurrent: () => assertCurrent(snapshot),
            async run(input: unknown, { preview = true, source = 'api', signal: runSignal }: ApplyOptions = {}): Promise<Result> {
                if (consumed) {reject('stage-consumed');}
                assertCurrent(snapshot);
                const result = await settle(compiled, start, input, { signal: runSignal || signal });
                if (!result.ok) {return result;}
                if (Object.keys(result.state as JsonObject).some(root => !history.roots.includes(root))) {reject('unowned-root');}
                const receipt = makeReceipt({ before: start, result, source, revision: history.revision + 1 });
                const next = clone(records);
                const retained = target.entries.slice(position).filter(entry => !replaces(entry));
                next[snapshot.index].entries = [...target.entries.slice(0, position), receipt, ...retained];
                const state = rebase(result.state, [...retained, ...next.slice(snapshot.index + 1).flatMap(record => record.entries)]);
                const updated: History = { ...clone(history), version: digest(compiled.bundle), checkpoints: snapshot.index === records.length - 1 && !suffix.length ? clone(history.checkpoints) : [] };
                assertCurrent(snapshot); (runSignal || signal)?.throwIfAborted();
                if (preview) {return { ...result, committed: false };}
                consumed = true;
                // A point is the saved end state, not the earlier insertion point.
                if (snapshot.index === records.length - 1) {checkpoint(updated, state, snapshot.index, updated.revision + 1);}
                return publish(snapshot, updated, next, { ...result, state, version: updated.version, receipt }, true);
            },
        };
    }
    return {
        stage,
        async inspect() {
            const snapshot = adapter.capture();
            if (!snapshot.history) {return { ok: false as const, diagnostics: [{ code: 'not-enabled' }] };}
            const bundle = adapter.bundle();
            return { ...success(clone(snapshot.state)), version: digest(bundle), bundle: clone(bundle),
                receipt: snapshot.records[snapshot.index]?.entries.at(-1) };
        },
        async enable({ signal }: RunOptions = {}): Promise<Result> {
            const snapshot = adapter.capture();
            if (snapshot.history) {reject('already-enabled');}
            const compiled = compileDefinition(adapter.bundle());
            const existing = snapshot.state as JsonObject;
            const start = { ...clone(compiled.definition.initial), ...Object.fromEntries(variableRoots(compiled.definition)
                .filter(root => Object.hasOwn(existing, root)).map(root => [root, clone(existing[root])])) };
            const result = await settle(compiled, start, [], { signal });
            if (!result.ok) {return result;}
            signal?.throwIfAborted();
            const roots = variableRoots(compiled.definition);
            if (Object.keys(result.state as JsonObject).some(root => !roots.includes(root))) {reject('unowned-root');}
            const history: History = { format: 2, roots, version: digest(compiled.bundle), revision: 0, checkpoints: [] };
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
            const state = rebase(rewind(history, snapshot.state, [...removed, ...later]), later);
            signal?.throwIfAborted();
            return publish(snapshot, { ...clone(history), checkpoints: [] }, records,
                { ...success(state), changes: displayChanges(difference(snapshot.state, state)), version: history.version }, true);
        },
        async restoreSelection(previous: Receipt[], next: Receipt[] = []): Promise<Result | undefined> {
            const snapshot = adapter.capture(), history = snapshot.history;
            if (!history || (!previous.length && !next.length)) {return;}
            const entries = clone(next);
            const state = rebase(rewind(history, snapshot.state, previous), entries);
            const rebased = new Map(entries.map(entry => [entry.id, entry]));
            const records = snapshot.records.map(record => ({ entries: record.entries.map(entry => rebased.get(entry.id) || entry) }));
            return publish(snapshot, { ...clone(history), checkpoints: [] }, records,
                { ...success(state), changes: displayChanges(difference(snapshot.state, state)), version: history.version }, true);
        },
    };
}
export type SettlementService = ReturnType<typeof createSettlementService>;
