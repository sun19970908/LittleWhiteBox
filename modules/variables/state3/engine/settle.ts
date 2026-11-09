import type { Compiled, Json, JsonObject, Result, RunOptions, EvaluationContext, Success, Source } from '../types.js';
import { changes, clone, contains, overlaps, assertJson, pathOf, setAt, equal } from './data.js';
import { evaluate } from './expressions.js';
import { reject, diagnostic } from './diagnostics.js';
import { difference } from './difference.js';
import { displayChanges } from './delta-view.js';
import { digest } from '../definition/digest.js';
import { applyDirectInput, inputFields, validateInput } from './input.js';
import { validateState } from './validation.js';

// A runaway, non-repeating trigger chain must also return control to the player.
export const TRIGGER_BUDGET_MS = 2000;

function authorize(compiled: Compiled, before: Json, after: Json, actor: string) {
    for (const change of changes(before, after)) {
        const derived = compiled.rules.find(rule => rule.kind === 'derive' && overlaps(rule.path, change.path));
        if (derived) {reject('derived-write', { path: change.path, rule: derived.id, actor });}
        const access = compiled.definition.access.filter(entry => contains(entry.path, change.path));
        if (!access.length || access.some(entry => !entry.write.includes(actor))) {reject('permission', { path: change.path, actor });}
    }
}

// No storage, host events, or publication here. The returned candidate belongs to
// the caller; every path (including preview) executes this same settlement.
export async function settle(compiled: Compiled, start: Json, input: unknown, { signal }: RunOptions = {}): Promise<Result> {
    const provenance: Success['provenance'] = [], actions: Success['actions'] = [];
    let operationIndex: number | undefined;
    let ruleId: string | undefined;
    try {
        signal?.throwIfAborted();
        assertJson(start);
        input = clone(input);
        validateInput(input);
        const before = clone(start), state = clone(start);
        const context: EvaluationContext = { bundle: compiled.bundle, before, state, params: {}, signal };
        const record = (previous: Json, source: Source) => {
            for (const change of changes(previous, state)) {provenance.push({ ...change, source });}
        };
        const stabilize = async () => {
            for (const rule of compiled.rules) {
                ruleId = rule.id;
                const previous = clone(state);
                const value = await evaluate(rule.value, context);
                assertJson(value);
                setAt(state, rule.path, value);
                record(previous, { kind: rule.kind, id: rule.id });
            }
            for (const rule of compiled.rules.filter(item => item.kind === 'correct')) {
                ruleId = rule.id;
                const value = await evaluate(rule.value, context);
                const candidate = clone(state);
                setAt(candidate, rule.path, value);
                if (!equal(candidate, state)) {reject('correction-unstable', { rule: rule.id });}
            }
            ruleId = undefined;
        };
        const effects = async (items: Compiled['definition']['actions'][number]['effects']) => {
            const values = [];
            for (const effect of items) {
                const value = await evaluate(effect.value, context);
                assertJson(value); values.push({ path: effect.path, value });
            }
            for (const effect of values) {setAt(state, effect.path, effect.value);}
        };
        const trigger = async (timing: 'action' | 'batch') => {
            const selected = (compiled.definition.triggers || []).filter(item => (item.timing || 'batch') === timing);
            if (!selected.length) {return;}
            const visited = new Set<string>(), chain = new Set<string>(), started = performance.now();
            let rounds = 0;
            while (true) {
                signal?.throwIfAborted();
                const key = digest(state);
                if (visited.has(key) || performance.now() - started > TRIGGER_BUDGET_MS) {
                    reject('trigger-cycle', { rules: [...chain], timing, budgetMs: TRIGGER_BUDGET_MS });
                }
                visited.add(key);
                let changed = false;
                for (const rule of selected) {
                    ruleId = rule.id;
                    if (await evaluate(rule.when, context) !== true) {continue;}
                    const previous = clone(state);
                    await effects(rule.effects);
                    if (equal(previous, state)) {continue;}
                    changed = true; chain.add(rule.id);
                    record(previous, { kind: 'trigger', id: rule.id });
                    await stabilize();
                }
                ruleId = undefined;
                if (!changed) {return;}
                // Let cancellation and the browser paint run between long chains.
                if (++rounds % 16 === 0) {await new Promise<void>(resolve => setTimeout(resolve, 0));}
            }
        };
        // Stored derived values may predate the current rules; actions read the recalculated state.
        let pendingDirect = true;
        for (const [index, operation] of input.entries()) {
            operationIndex = index;
            signal?.throwIfAborted();
            if (!operation.action) {
                const previous = clone(state);
                applyDirectInput(state, operation);
                authorize(compiled, previous, state, 'direct');
                record(previous, { kind: 'input' });
                pendingDirect = true;
                continue;
            }
            if (pendingDirect) { await stabilize(); pendingDirect = false; }
            const action = compiled.actions.get(String(operation.action));
            if (!action) {reject('action-missing', { action: operation.action });}
            ruleId = action.id;
            context.params = clone(operation.params as JsonObject);
            for (const conversion of action.conversions) {
                const value = await evaluate(conversion.value, context);
                assertJson(value);
                setAt(context.params, conversion.path, value);
            }
            if (!action.validate(context.params)) {reject('action-parameters', { action: action.id, errors: clone(action.validate.errors) });}
            if (await evaluate(action.requires, context) !== true) {reject('action-precondition', { action: action.id });}
            const previous = clone(state);
            // One action's effects observe the same pre-action state.
            await effects(action.effects);
            authorize(compiled, previous, state, action.id);
            record(previous, { kind: 'action', id: action.id });
            actions.push({ id: action.id, params: clone(context.params) });
            await stabilize();
            context.params = {};
            await trigger('action');
        }
        context.params = {};
        await stabilize();
        await trigger('batch');
        const errors = await validateState(compiled, context);
        if (errors.length) { const { code, ...detail } = errors[0]; reject(code, detail); }
        signal?.throwIfAborted();
        const annotations = input.flatMap((operation, index) => {
            const fields = Object.entries(operation).filter(([name]) => !inputFields(operation).includes(name));
            return fields.length ? [{ index, ...(operation.action ? { action: String(operation.action) } : { path: pathOf(operation.path) }), fields }] : [];
        });
        return { ok: true, state, changes: displayChanges(difference(before, state)), provenance, actions, diagnostics: [], ...(annotations.length ? { annotations } : {}) };
    } catch (error) {
        const detail = diagnostic(error);
        return { ok: false, diagnostics: [signal?.aborted ? { code: 'cancelled' } : { ...detail,
            ...(ruleId && !detail.rule ? { rule: ruleId } : {}),
            ...(operationIndex === undefined ? {} : { operation: operationIndex, path: detail.path ?? (input as JsonObject[])[operationIndex]?.path }),
        }] };
    }
}

export const initialize = (compiled: Compiled, options: RunOptions = {}) => settle(compiled, compiled.definition.initial, [], options);
