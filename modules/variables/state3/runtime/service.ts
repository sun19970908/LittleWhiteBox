import { compileDefinition } from '../definition/compile.js';
import { clone, equal } from '../engine/data.js';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';
import { difference } from '../engine/difference.js';
import { displayChanges } from '../engine/delta-view.js';
import { settle } from '../engine/settle.js';
import { variableRoots } from './variables.js';
import { reject, diagnostic } from '../engine/diagnostics.js';
import { validateState } from '../engine/validation.js';
import { checkpoint, digest, makeReceipt, rebase, rewind } from './history.js';
import type { BeforeUpdate, History, HostAdapter, Json, JsonObject, Receipt, Result, RunOptions, Snapshot, Success, SwipeRecord } from '../types.js';
import { modelSource } from '../definition/stages.js';

interface StageOptions extends RunOptions { index?: number; replace?: boolean }
interface ApplyOptions extends StageOptions { preview?: boolean; source?: string; beforeUpdate?: BeforeUpdate }
const success = (state: Json): Success => ({ ok: true, state, changes: [], provenance: [], actions: [], diagnostics: [] });

export function createSettlementService<S extends Snapshot>(adapter: HostAdapter<S>) {
    const assertCurrent = (snapshot: S) => { if (!adapter.isCurrent(snapshot)) {reject('stale-target');} };
    async function checkRestoration(state: Json, signal?: AbortSignal) {
        try {
            const compiled = compileDefinition(adapter.bundle());
            return await validateState(compiled, { bundle: compiled.bundle, state: clone(state), params: {}, signal });
        } catch (error) { return [diagnostic(error)]; }
    }
    async function publish(snapshot: S, history: History, records: SwipeRecord[], result: Success, notify: boolean, hostSaves = false, invalidateFrom?: number): Promise<Success> {
        assertCurrent(snapshot);
        // Validation and publication are synchronous. Only persistence may wait;
        // another selection must be able to restore this state while it waits.
        history.revision++;
        const save = adapter.publish(snapshot, { state: result.state, history, records, ...(invalidateFrom === undefined ? {} : { invalidateFrom }) });
        let persistence: Success['persistence'];
        try { if (!hostSaves) {await save();} }
        catch (error) { persistence = { code: 'save-unconfirmed', message: error instanceof Error ? error.message : String(error) }; }
        const published = { ...result, committed: true, ...(hostSaves ? {} : { saved: !persistence }), ...(persistence ? { persistence } : {}) };
        if (notify) {
            try { adapter.committed?.(published); }
            catch (error) { published.diagnostics.push({ code: 'notification-failed', message: error instanceof Error ? error.message : String(error) }); }
        }
        return published;
    }
    async function rollback({ index, signal }: RunOptions & { index?: number } = {}): Promise<Success> {
        const snapshot = adapter.capture(index), history = snapshot.history;
        adapter.assertMutable(snapshot); assertCurrent(snapshot); signal?.throwIfAborted();
        if (!history) {reject('not-enabled');}
        const records = clone(snapshot.records), suffix = records.slice(snapshot.index).flatMap(record => record.entries);
        if (snapshot.lastReceiptIndex < snapshot.index) {return { ...success(clone(snapshot.state)), saved: true };}
        const state = rewind(history, snapshot.state, suffix);
        records.slice(snapshot.index).forEach(record => {record.entries = [];});
        // Persist the real rollback before any model call or new rule execution.
        // Failure/cancellation after this point leaves the rolled-back state intact.
        const publication = publish(snapshot, { ...clone(history), checkpoints: [] }, records,
            { ...success(state), changes: displayChanges(difference(snapshot.state, state)), version: history.version }, true, false, snapshot.index);
        const rolledBack = adapter.capture(snapshot.index);
        const result = await publication;
        assertCurrent(rolledBack); adapter.assertMutable(rolledBack);
        return result;
    }
    async function stage({ index, replace, signal, stage: preparedStage }: StageOptions = {}) {
        const snapshot = adapter.capture(index), history = snapshot.history;
        const compiled = compileDefinition(adapter.bundle());
        if (!history) {reject('not-enabled');}
        const records = clone(snapshot.records), target = records[snapshot.index];
        if (!target) {reject('target-missing');}
        adapter.assertMutable(snapshot);
        // Replacement always means the whole floor and its suffix, not one source
        // merged back into already-confirmed later effects. Preview remains read-only.
        const suffix = replace ? records.slice(snapshot.index).flatMap(record => record.entries) : [];
        const start = replace ? rewind(history, snapshot.state, suffix) : clone(snapshot.state);
        assertCurrent(snapshot);
        let consumed = false;
        let candidate: { input: unknown; stage: RunOptions['stage']; result: Success } | undefined;
        async function commit(result: Success, source: string, beforeUpdate?: BeforeUpdate): Promise<Success> {
            if (consumed) {reject('stage-consumed');}
            assertCurrent(snapshot); adapter.assertMutable(snapshot); signal?.throwIfAborted();
            if (records.slice(snapshot.index + 1).some(record => record.entries.length)) {reject('stale-target');}
            const receipt = makeReceipt({ before: start, result, source, revision: history!.revision + 1 });
            if (beforeUpdate) {receipt.beforeUpdate = clone(beforeUpdate);}
            const next = clone(records);
            next[snapshot.index].entries = [...target.entries, receipt];
            const state = result.state;
            const updated: History = { ...clone(history!), version: digest(compiled.bundle), checkpoints: snapshot.index === records.length - 1 && !suffix.length ? clone(history!.checkpoints) : [] };
            consumed = true;
            if (snapshot.index === records.length - 1) {checkpoint(updated, state, snapshot.index, updated.revision + 1);}
            const hostSaves = snapshot.index === records.length - 1 && beforeUpdate !== undefined
                && ['applied', 'rejected', 'skipped'].includes(beforeUpdate.outcome);
            return publish(snapshot, updated, next, { ...result, state, version: updated.version, receipt }, true, hostSaves);
        }
        return {
            ok: true as const, snapshot: clone(start), bundle: clone(compiled.bundle), roots: clone(history.roots), target: snapshot.target,
            assertCurrent: () => assertCurrent(snapshot),
            async recordBefore(outcome: BeforeUpdate): Promise<Success> {
                if (replace && snapshot.lastReceiptIndex >= snapshot.index) {
                    assertCurrent(snapshot); consumed = true;
                    const rolledBack = await rollback({ index: snapshot.index, signal });
                    if (rolledBack.saved === false) {return rolledBack;}
                    signal?.throwIfAborted();
                    return (await stage({ index: snapshot.index, signal })).recordBefore(outcome);
                }
                return commit(success(clone(start)), modelSource('before'), outcome);
            },
            async run(input: unknown, { preview = true, source = 'api', signal: runSignal, stage: updateStage = preparedStage, beforeUpdate }: ApplyOptions = {}): Promise<Result> {
                if (consumed) {reject('stage-consumed');}
                assertCurrent(snapshot); adapter.assertMutable(snapshot);
                const activeSignal = mergeAbortSignals(signal, runSignal) ?? undefined;
                if (!preview && replace && snapshot.lastReceiptIndex >= snapshot.index) {
                    consumed = true;
                    const rolledBack = await rollback({ index: snapshot.index, signal: activeSignal });
                    if (rolledBack.saved === false) {return rolledBack;}
                    activeSignal?.throwIfAborted();
                    return (await stage({ index: snapshot.index, signal: activeSignal })).run(input,
                        { preview: false, source, stage: updateStage, signal: activeSignal, beforeUpdate });
                }
                const result = candidate && candidate.stage === updateStage && equal(candidate.input as Json, input as Json)
                    ? clone(candidate.result) : await settle(compiled, start, input, { signal: activeSignal, stage: updateStage });
                if (!result.ok) {return result;}
                if (Object.keys(result.state as JsonObject).some(root => !history.roots.includes(root))) {reject('unowned-root');}
                assertCurrent(snapshot); activeSignal?.throwIfAborted();
                candidate = { input: clone(input), stage: updateStage, result: clone(result) };
                if (preview) {return { ...result, version: digest(compiled.bundle), committed: false };}
                return commit(result, source, beforeUpdate);
            },
        };
    }
    return {
        stage, rollback,
        async recordBefore(index: number, outcome: BeforeUpdate, options: RunOptions = {}) {
            const staged = await stage({ index, replace: true, ...options });
            return staged.recordBefore(outcome);
        },
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
            const staged = await stage(options);
            return staged.run(input, { ...options, preview: false });
        },
        async preview(input: unknown, options: ApplyOptions = {}) {
            const staged = await stage(options);
            return staged.run(input, { ...options, preview: true });
        },
        async undo({ index, signal, all = false }: RunOptions & { index?: number; all?: boolean } = {}): Promise<Result> {
            const snapshot = adapter.capture(index), history = snapshot.history, records = clone(snapshot.records);
            adapter.assertMutable(snapshot);
            if (!history || !records[snapshot.index]?.entries.length) {reject('nothing-to-undo');}
            if (all) {return rollback({ index: snapshot.index, signal });}
            const target = records[snapshot.index], later = records.slice(snapshot.index + 1).flatMap(record => record.entries);
            const removed = target.entries.splice(-1);
            const state = rewind(history, snapshot.state, [...removed, ...later]);
            records.slice(snapshot.index + 1).forEach(record => {record.entries = [];});
            signal?.throwIfAborted();
            return publish(snapshot, { ...clone(history), checkpoints: [] }, records,
                { ...success(state), changes: displayChanges(difference(snapshot.state, state)), version: history.version }, true, false, snapshot.index);
        },
        async restoreSelection(previous: Receipt[], next: Receipt[] = [], { check = false, signal }: RunOptions & { check?: boolean } = {}): Promise<Result | undefined> {
            const snapshot = adapter.capture(), history = snapshot.history;
            if (!history || (!previous.length && !next.length)) {return;}
            const entries = clone(next);
            const state = rebase(rewind(history, snapshot.state, previous), entries);
            const rebased = new Map(entries.map(entry => [entry.id, entry]));
            const records = snapshot.records.map(record => ({ entries: record.entries.map(entry => rebased.get(entry.id) || entry) }));
            // Publish synchronously: validation warns about the restored state; it never vetoes a native swipe.
            const publication = publish(snapshot, { ...clone(history), checkpoints: [] }, records,
                { ...success(state), changes: displayChanges(difference(snapshot.state, state)), version: history.version }, true);
            const validation = check ? checkRestoration(state, signal) : Promise.resolve([]);
            const [result, restoration] = await Promise.all([publication, validation]);
            return { ...result, restoration };
        },
    };
}
export type SettlementService = ReturnType<typeof createSettlementService>;
