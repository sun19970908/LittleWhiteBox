import type { Bundle, Compiled, Definition, Expression, Schema } from '../types.js';
import Ajv from 'ajv';
import { definitionSchema } from './format.js';
import { assertJson, clone, overlaps, pathOf } from '../engine/data.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { orderRules } from '../engine/dependencies.js';
import { readsOf } from '../engine/expressions.js';
import { checkStages } from './stages.js';
import { activeScript, checkExtensions, checkPreparedScope, usesPrepared, extensionPath } from '../extensions/definition.js';

const createValidator = () => new Ajv({ allErrors: true, strict: true, ownProperties: true });
const validateDefinition = createValidator().compile(definitionSchema);
function compileSchema(ajv: Ajv, schema: Schema) {
    const validate = ajv.compile(schema);
    if ('$async' in validate && validate.$async) {reject('async-schema');}
    return validate;
}

function unique(items: { id: string }[]) {
    const ids = new Set();
    for (const item of items) {
        if (ids.has(item.id)) {reject('duplicate-id', { rule: item.id });}
        ids.add(item.id);
    }
}
function checkExpression(expression: Expression, definition: Definition) {
    readsOf(expression, definition);
    const arity: Record<string, number> = { subtract: 2, divide: 2, eq: 2, ne: 2, lt: 2, lte: 2, gt: 2, gte: 2, not: 1, if: 3, length: 1, includes: 2 };
    if (expression.op && ((arity[expression.op] && (expression.args || []).length !== arity[expression.op]) || !(expression.args || []).length)) {reject('expression-arity', { operation: expression.op });}
    for (const item of expression.args || []) {checkExpression(item, definition);}
}

export function compileDefinition(input: unknown): Compiled {
    assertJson(input);
    const bundle = clone(input) as unknown as Bundle, { definition, functions } = bundle;
    if (Object.keys(bundle).some(key => !['definition', 'functions', 'tools', 'scripts'].includes(key))) {reject('definition-shape');}
    if (!definition || !functions || typeof functions !== 'object' || Array.isArray(functions)) {reject('definition-shape');}
    if (!validateDefinition(definition)) {reject('definition-schema', { errors: clone(validateDefinition.errors) });}
    for (const [opening, values] of (definition.openings || []).entries()) {
        for (const root of Object.keys(values)) {
            if (!Object.hasOwn(definition.initial, root)) {reject('unowned-root', { path: ['openings', String(opening), root], opening });}
        }
    }
    checkStages(definition);
    checkExtensions(bundle);
    unique([...definition.rules, ...definition.actions, ...definition.constraints, ...(definition.triggers || [])]);
    definition.access.forEach(entry => pathOf(entry.path));
    for (const rule of definition.rules) { pathOf(rule.path); checkExpression(rule.value, definition); checkPreparedScope(rule.value); }
    for (const constraint of definition.constraints) {checkExpression(constraint.test, definition); checkPreparedScope(constraint.test);}
    for (const trigger of definition.triggers || []) {
        checkExpression(trigger.when, definition);
        checkPreparedScope(trigger.when);
        for (const effect of trigger.effects) {
            pathOf(effect.path); checkExpression(effect.value, definition);
            checkPreparedScope(effect.value);
            const derived = definition.rules.find(rule => rule.kind === 'derive' && overlaps(rule.path, effect.path));
            if (derived) {reject('derived-write', { rule: trigger.id, path: effect.path, derived: derived.id });}
        }
    }
    for (const [name, fn] of Object.entries(definition.functions)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(name) || typeof functions[name] !== 'string' || !functions[name].trim()) {reject('function-missing', { rule: name });}
        fn.reads.forEach(pathOf);
    }
    for (const name of Object.keys(functions)) {if (!Object.hasOwn(definition.functions, name)) {reject('function-undeclared', { rule: name });}}
    for (const view of Object.values(definition.views)) {view.paths.forEach(pathOf);}
    const actions = new Map();
    // Ajv caches by schema object identity. A card is cloned for isolation on
    // each compilation, so keeping this instance globally retains every turn.
    const schemas = createValidator();
    const tools = new Map(Object.entries(definition.extensions?.tools || {}).map(([name, tool]) => [name, compileSchema(schemas, tool.parameters)]));
    for (const action of definition.actions) {
        if (!activeScript(bundle, 'prepare') && [action.requires, ...[...action.effects, ...action.conversions].map(effect => effect.value)].some(usesPrepared)) {
            reject('prepared-unavailable', { rule: action.id, path: extensionPath('prepare') });
        }
        checkExpression(action.requires, definition);
        for (const effect of [...action.effects, ...action.conversions]) { pathOf(effect.path); checkExpression(effect.value, definition); }
        actions.set(action.id, { ...action, validate: compileSchema(schemas, action.parameters) });
    }
    return { bundle, definition, rules: orderRules(definition), actions, tools, validate: compileSchema(schemas, definition.schema) };
}

export function checkDefinition(bundle: unknown) {
    try { compileDefinition(bundle); return { ok: true, diagnostics: [] }; }
    catch (error) { return { ok: false, diagnostics: [diagnostic(error)] }; }
}
