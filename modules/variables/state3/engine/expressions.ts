import type { Expression, Definition, Path, EvaluationContext, Json } from '../types.js';
import { assertJson, equal, getAt, pathOf } from './data.js';
import { reject } from './diagnostics.js';
import { runFunction } from './functions.js';

// All referenced state, including batch-start paths and declared function reads.
// Dependency ordering below intentionally uses only current-state reads.
export function references(expression: Expression, definition: Definition): Path[] {
    const own = [expression.get, expression.before].filter((path): path is Path => Array.isArray(path));
    const called = expression.call ? definition.functions[expression.call]?.reads || [] : [];
    return [...own, ...called, ...(expression.args || []).flatMap(item => references(item, definition))];
}

export function readsOf(expression: Expression, definition: Definition): Path[] {
    if (expression.get) {return [pathOf(expression.get)];}
    if (expression.before) { pathOf(expression.before); return []; }
    if (expression.param) { pathOf(expression.param); return []; }
    const nested = (expression.args || []).flatMap(item => readsOf(item, definition));
    if (expression.call) {
        const fn = definition.functions[expression.call];
        if (!fn) {reject('function-missing', { rule: expression.call });}
        return [...nested, ...fn.reads.map(pathOf)];
    }
    return nested;
}

export async function evaluate(expression: Expression, context: EvaluationContext): Promise<Json | undefined> {
    context.signal?.throwIfAborted();
    if (Object.hasOwn(expression, 'literal')) {return structuredClone(expression.literal);}
    if (expression.get) {return getAt(context.state, expression.get);}
    if (expression.before) {
        if (context.before === undefined) {reject('before-unavailable');}
        return getAt(context.before, expression.before);
    }
    if (expression.param) {return getAt(context.params, expression.param);}
    const args = expression.args || [];
    // Branches are lazy: inactive rules need not read absent optional state.
    if (expression.op === 'if') {return evaluate(args[await evaluate(args[0], context) ? 1 : 2], context);}
    if (expression.op === 'and') { for (const item of args) {if (!await evaluate(item, context)) {return false;}} return true; }
    if (expression.op === 'or') { for (const item of args) {if (await evaluate(item, context)) {return true;}} return false; }
    const values = [];
    for (const item of args) {values.push(await evaluate(item, context));}
    if (expression.call) {
        const name = expression.call;
        assertJson(values);
        return runFunction({ id: name, source: context.bundle.functions[name], input: values,
            reads: context.bundle.definition.functions[name].reads, state: context.state,
            beforeState: context.before, signal: context.signal });
    }
    const [a, b] = values;
    switch (expression.op) {
        case 'add': return values.reduce<number>((sum, value) => sum + number(value), 0);
        case 'subtract': return number(a) - number(b);
        case 'multiply': return values.reduce<number>((product, value) => product * number(value), 1);
        case 'divide': if (number(b) === 0) {reject('division-zero');} return number(a) / number(b);
        case 'min': return Math.min(...values.map(number));
        case 'max': return Math.max(...values.map(number));
        case 'eq': return equal(a, b);
        case 'ne': return !equal(a, b);
        case 'lt': return number(a) < number(b);
        case 'lte': return number(a) <= number(b);
        case 'gt': return number(a) > number(b);
        case 'gte': return number(a) >= number(b);
        case 'not': return !a;
        case 'length': if (!Array.isArray(a) && typeof a !== 'string') {reject('expression-type');} return a.length;
        case 'includes': if (!Array.isArray(a) && typeof a !== 'string') {reject('expression-type');} return typeof a === 'string' ? a.includes(String(b)) : a.some(item => equal(item, b));
        default: reject('expression-operation', { operation: expression.op });
    }
}
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) {reject('expression-type');} return value; }
