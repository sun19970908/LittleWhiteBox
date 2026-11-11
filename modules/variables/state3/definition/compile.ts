import type { Bundle, Compiled, Definition, Expression, Schema } from '../types.js';
import Ajv from 'ajv';
import { definitionSchema } from './format.js';
import { assertJson, clone, overlaps, pathOf } from '../engine/data.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { orderRules } from '../engine/dependencies.js';
import { readsOf } from '../engine/expressions.js';
import { checkStages } from './stages.js';

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
    if (Object.keys(bundle).some(key => !['definition', 'functions'].includes(key))) {reject('definition-shape');}
    if (!definition || !functions || typeof functions !== 'object' || Array.isArray(functions)) {reject('definition-shape');}
    if (!validateDefinition(definition)) {reject('definition-schema', { errors: clone(validateDefinition.errors) });}
    checkStages(definition);
    unique([...definition.rules, ...definition.actions, ...definition.constraints, ...(definition.triggers || [])]);
    const actionIds = new Set(definition.actions.map(action => action.id));
    for (const entry of definition.access) {
        pathOf(entry.path);
        for (const actor of entry.write) {if (actor !== 'direct' && !actionIds.has(actor)) {reject('access-action', { action: actor, path: entry.path });}}
    }
    for (const rule of definition.rules) { pathOf(rule.path); checkExpression(rule.value, definition); }
    for (const constraint of definition.constraints) {checkExpression(constraint.test, definition);}
    for (const trigger of definition.triggers || []) {
        checkExpression(trigger.when, definition);
        for (const effect of trigger.effects) {
            pathOf(effect.path); checkExpression(effect.value, definition);
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
    for (const action of definition.actions) {
        checkExpression(action.requires, definition);
        for (const effect of [...action.effects, ...action.conversions]) { pathOf(effect.path); checkExpression(effect.value, definition); }
        actions.set(action.id, { ...action, validate: compileSchema(schemas, action.parameters) });
    }
    return { bundle, definition, rules: orderRules(definition), actions, validate: compileSchema(schemas, definition.schema) };
}

export function checkDefinition(bundle: unknown) {
    try { compileDefinition(bundle); return { ok: true, diagnostics: [] }; }
    catch (error) { return { ok: false, diagnostics: [diagnostic(error)] }; }
}
