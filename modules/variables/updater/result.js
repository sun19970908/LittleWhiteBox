import { getStateInputSchema } from '../state2/json-input.js';
import { resultDifference } from './result-diff.js';

const schema = getStateInputSchema();
const operationFields = new Map(schema.properties.ops.items.anyOf.map(item => [item.properties.op.enum[0], new Set(Object.keys(item.properties))]));
const inputFields = new Set(Object.keys(schema.properties));
const extras = (value, fields) => Object.entries(value || {}).filter(([name]) => !fields.has(name));

/** Annotations stay separate from actual execution results, including AI's old. */
export function presentResult(result, input) {
    const submitted = typeof input === 'string' ? JSON.parse(input) : input;
    const operations = new Map();
    for (const [index, item] of (submitted?.ops || []).entries()) {
        operations.set(index, { path: item.path, changes: [], annotations: extras(item, operationFields.get(item.op) || new Set(['op', 'path'])) });
    }
    for (const change of result.changes || []) {
        if (!operations.has(change.index)) operations.set(change.index, { path: change.path, changes: [], annotations: [] });
        operations.get(change.index).changes.push(...resultDifference(change.oldValue, change.newValue, change.path));
    }
    return { operations: [...operations.values()], annotations: extras(submitted, inputFields), errors: result.errors || [], corrections: result.corrections || [] };
}
