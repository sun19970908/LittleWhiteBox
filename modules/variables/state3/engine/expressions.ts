import type { Expression, Definition, Path, EvaluationContext, Json, Schema, Condition, ConditionValue, Comparison } from '../types.js';
import { fieldName } from '../definition/schema-fields.js';
import { assertJson, equal, getAt, pathOf } from './data.js';
import { diagnostic, reject } from './diagnostics.js';
import { createFunctionRunner } from './functions.js';

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
    if (expression.prepared) { pathOf(expression.prepared); return []; }
    const nested = (expression.args || []).flatMap(item => readsOf(item, definition));
    if (expression.call) {
        const fn = definition.functions[expression.call];
        if (!fn) {reject('function-missing', { rule: expression.call });}
        return [...nested, ...fn.reads.map(pathOf)];
    }
    return nested;
}

export async function evaluate(expression: Expression, context: EvaluationContext, expressionPath: Path = []): Promise<Json | undefined> {
    try {return await evaluateNode(expression, context, expressionPath);}
    catch (error) {
        const issue = diagnostic(error);
        reject(issue.code, { ...issue, expressionPath: issue.expressionPath ?? expressionPath });
    }
}
async function evaluateNode(expression: Expression, context: EvaluationContext, expressionPath: Path): Promise<Json | undefined> {
    context.signal?.throwIfAborted();
    if (Object.hasOwn(expression, 'literal')) {return structuredClone(expression.literal);}
    if (expression.get) {return getAt(context.state, expression.get);}
    if (expression.before) {
        if (context.before === undefined) {reject('before-unavailable');}
        return getAt(context.before, expression.before);
    }
    if (expression.param) {return getAt(context.params, expression.param);}
    if (expression.prepared) {
        if (context.prepared === undefined) {reject('prepared-missing', { path: expression.prepared });}
        return getAt(context.prepared, expression.prepared);
    }
    const args = expression.args || [];
    const child = (index: number) => evaluate(args[index], context, [...expressionPath, 'args', String(index)]);
    // Branches are lazy: inactive rules need not read absent optional state.
    if (expression.op === 'if') {return child(await child(0) ? 1 : 2);}
    if (expression.op === 'and') { for (let index = 0; index < args.length; index++) {if (!await child(index)) {return false;}} return true; }
    if (expression.op === 'or') { for (let index = 0; index < args.length; index++) {if (await child(index)) {return true;}} return false; }
    const values = [];
    for (let index = 0; index < args.length; index++) {values.push(await child(index));}
    if (expression.call) {
        const name = expression.call;
        assertJson(values);
        const runner = context.functions ?? createFunctionRunner();
        try {
            return await runner.run({ id: name, source: context.bundle.functions[name], input: values,
                reads: context.bundle.definition.functions[name].reads, state: context.state,
                beforeState: context.before, signal: context.signal });
        } finally { if (!context.functions) {runner.dispose();} }
    }
    const [a, b] = values;
    const operand = (value: unknown, index: number) => ({ operator: expression.op, operand: index,
        actualType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
        ...(value === undefined ? {} : { actual: typeof value === 'number' && !Number.isFinite(value) ? String(value) : value }) });
    const number = (value: unknown, index: number): number => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {reject('expression-type', { ...operand(value, index), expected: 'finite-number' });}
        return value;
    };
    switch (expression.op) {
        case 'add': return values.reduce<number>((sum, value, index) => sum + number(value, index), 0);
        case 'subtract': return number(a, 0) - number(b, 1);
        case 'multiply': return values.reduce<number>((product, value, index) => product * number(value, index), 1);
        case 'divide': if (number(b, 1) === 0) {reject('division-zero', operand(b, 1));} return number(a, 0) / number(b, 1);
        case 'min': return Math.min(...values.map(number));
        case 'max': return Math.max(...values.map(number));
        case 'eq': return equal(a, b);
        case 'ne': return !equal(a, b);
        case 'lt': return number(a, 0) < number(b, 1);
        case 'lte': return number(a, 0) <= number(b, 1);
        case 'gt': return number(a, 0) > number(b, 1);
        case 'gte': return number(a, 0) >= number(b, 1);
        case 'not': return !a;
        case 'length': if (!Array.isArray(a) && typeof a !== 'string') {reject('expression-type', { ...operand(a, 0), expected: 'string-or-array' });} return a.length;
        case 'includes': if (!Array.isArray(a) && typeof a !== 'string') {reject('expression-type', { ...operand(a, 0), expected: 'string-or-array' });} return typeof a === 'string' ? a.includes(String(b)) : a.some(item => equal(item, b));
        default: reject('expression-operation', { operation: expression.op });
    }
}

const inverse: Record<Comparison, Comparison> = { eq: 'ne', ne: 'eq', lt: 'gte', lte: 'gt', gt: 'lte', gte: 'lt' };

/** Called only after requires failed. Preserve lazy branches and explain the required truth value. */
export async function explainCondition(expression: Expression, context: EvaluationContext, parameters: Schema, expected = true): Promise<Condition> {
    const args = expression.args || [];
    if (expression.op === 'not') {return explainCondition(args[0], context, parameters, !expected);}
    if (expression.op === 'if') {return explainCondition(args[await evaluate(args[0], context) ? 1 : 2], context, parameters, expected);}
    if (expression.op === 'and' || expression.op === 'or') {
        const findOne = (expression.op === 'and') === expected;
        const conditions: Condition[] = [];
        for (const item of args) {
            if (Boolean(await evaluate(item, context)) === expected) {continue;}
            const condition = await explainCondition(item, context, parameters, expected);
            if (findOne) {return condition;}
            conditions.push(condition);
        }
        return { kind: 'any', conditions };
    }
    async function operand(item: Expression): Promise<ConditionValue> {
        const value = await evaluate(item, context);
        const path = item.get || item.before || item.param;
        return path ? { kind: item.param ? 'parameter' : 'field', path: [...path], name: fieldName(item.param ? parameters : context.bundle.definition.schema, path),
            ...(item.before ? { before: true } : {}), value } : { kind: 'value', value };
    }
    if (expression.op && Object.hasOwn(inverse, expression.op)) {
        const operator = expression.op as Comparison;
        return { kind: 'comparison', operator: expected ? operator : inverse[operator], left: await operand(args[0]), right: await operand(args[1]) };
    }
    if (expression.call) {return { kind: 'function', id: expression.call, description: context.bundle.definition.functions[expression.call].description, expected };}
    return { kind: 'value', operand: await operand(expression), expected };
}
