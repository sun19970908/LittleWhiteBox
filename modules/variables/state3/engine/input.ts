import type { Compiled, CompiledAction, Failure, Json, JsonObject, Path, SubmissionItem, UpdateStage } from '../types.js';
import { assertJson, clone, getAt, pathOf, setAt } from './data.js';
import { diagnostic, reject } from './diagnostics.js';
import { checkAction, checkDirectWrite } from './permissions.js';
import { parameterIssues } from '../definition/schema-fields.js';

interface DirectInput {
    description: string;
    parameters: Record<string, JsonObject>;
    apply(state: Json, path: Path, input: JsonObject): void;
}

// One contract for execution operands, model tools and annotation projection.
export const DIRECT_INPUTS = {
    set: {
        description: 'Assign the supplied value at path.',
        parameters: { value: {} },
        apply: (state, path, input) => setAt(state, path, input.value),
    },
    remove: {
        description: 'Remove the field or array element at path.',
        parameters: {},
        apply: (state, path) => setAt(state, path, undefined, true),
    },
    inc: {
        description: 'Add delta to the existing number at path when this item executes, including earlier changes in this batch. Missing or nonnumeric values fail. Card rules and final schema checks run at the usual settlement points.',
        parameters: { delta: { type: 'number', description: 'Signed amount to add; negative subtracts, zero leaves the number unchanged.' } },
        apply(state, path, input) {
            const current = getAt(state, path);
            if (typeof current !== 'number' || !Number.isFinite(current)) {reject('increment-target', { path, actual: current });}
            const next = current + (input.delta as number);
            if (!Number.isFinite(next)) {reject('increment-overflow', { path });}
            setAt(state, path, next);
        },
    },
} satisfies Record<string, DirectInput>;

const directInput = (op: Json): DirectInput => DIRECT_INPUTS[op as keyof typeof DIRECT_INPUTS];
export function inputFields(operation: JsonObject): string[] {
    return operation.action ? ['action', 'params'] : ['op', 'path', ...Object.keys(directInput(operation.op).parameters)];
}
export function applyDirectInput(state: Json, operation: JsonObject) {
    directInput(operation.op).apply(state, pathOf(operation.path), operation);
}

export function validateActionParameters(action: CompiledAction, params: JsonObject) {
    if (!action.validate(params)) {reject('action-parameters', { action: action.id, actionTitle: action.title,
        errors: clone(action.validate.errors), parameters: parameterIssues(action.parameters, action.validate.errors || []) });}
}

export function inspectInput(input: unknown, compiled: Compiled, stage?: UpdateStage): { ok: true; input: JsonObject[] } | Failure {
    if (!Array.isArray(input)) {return { ok: false, diagnostics: [{ code: 'input-shape' }] };}
    const items: SubmissionItem[] = [];
    for (const [index, operation] of input.entries()) {
        try {
            if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {reject('input-shape', { actual: operation });}
            if (operation.action) {
                if (typeof operation.action !== 'string') {reject('input-shape', { action: operation.action });}
                const action = checkAction(compiled, operation.action, stage);
                if (!operation.params || typeof operation.params !== 'object' || Array.isArray(operation.params)) {reject('input-shape', { action: operation.action });}
                // Conversions can read state changed by earlier items. Their output
                // is checked during execution, not against the unconverted input.
                if (!action.conversions.length) {validateActionParameters(action, operation.params);}
            } else {
                const path = pathOf(operation.path);
                if (stage) {checkDirectWrite(compiled.definition, path, stage);}
                if (typeof operation.op !== 'string' || !Object.hasOwn(DIRECT_INPUTS, operation.op)) {
                    reject('input-shape', { actual: operation.op, allowed: Object.keys(DIRECT_INPUTS) });
                }
                for (const [field, schema] of Object.entries(directInput(operation.op).parameters)) {
                    if (!Object.hasOwn(operation, field)) {reject('input-shape', { field });}
                    if (schema.type === 'number' && (typeof operation[field] !== 'number' || !Number.isFinite(operation[field]))) {
                        reject('input-number', { field, actual: operation[field] });
                    }
                }
            }
            assertJson(operation);
            items.push({ item: operation, status: 'static-passed' });
        } catch (error) {
            const detail = diagnostic(error);
            items.push({ item: operation, status: 'rejected', diagnostics: [{ ...detail, operation: index, path: detail.path ?? operation?.path }] });
        }
    }
    const diagnostics = items.flatMap(item => item.diagnostics || []);
    return diagnostics.length ? { ok: false, diagnostics, items } : { ok: true, input: input as JsonObject[] };
}
