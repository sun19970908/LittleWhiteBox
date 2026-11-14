import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDefinition } from '../definition/compile.js';
import { settle } from '../engine/settle.js';
import type { Bundle, Condition, Diagnostic, Expression, Json } from '../types.js';

const literal = (value: Json): Expression => ({ literal: value });
const get = (key: string): Expression => ({ get: [key] });
const op = (name: string, ...args: Expression[]): Expression => ({ op: name, args });
function card(): Bundle {
    return { definition: {
        format: 1, updates: ['after'], name: 'Diagnostic contract', initial: { cash: 102, locked: true, bought: false },
        schema: { type: 'object', properties: { cash: { type: 'number', title: '现金' }, locked: { type: 'boolean' }, bought: { type: 'boolean' } }, additionalProperties: false },
        access: [{ path: ['bought'], direct: false, description: 'Purchase flag' }], rules: [], constraints: [], views: {},
        functions: { route: { reads: [], description: 'Checks the selected route' } },
        actions: [{ id: 'buy', title: '购买', description: 'Purchase costs quantity times three',
            parameters: { type: 'object', required: ['quantity'], additionalProperties: false,
                properties: { quantity: { type: 'integer', title: '数量', minimum: 1, maximum: 99 } } }, conversions: [],
            requires: op('and', literal(true), op('gte', get('cash'), op('multiply', { param: ['quantity'] }, literal(3)))),
            effects: [{ path: ['bought'], value: literal(true) }],
        }],
    }, functions: { route: '() => false' } };
}
async function failure(bundle: Bundle, params: Record<string, Json> = { quantity: 99 }): Promise<Diagnostic> {
    const start = structuredClone(bundle.definition.initial);
    const result = await settle(compileDefinition(bundle), start, [{ action: 'buy', params }]);
    assert.equal(result.ok, false);
    assert.deepEqual(start, bundle.definition.initial);
    return result.diagnostics[0];
}

// D1: a rejected action identifies the failing requirement with actual and required
// values, even without the definition in the viewer (misleading recovery / repeated failures).
test('D1: a failed conjunction reports the exact comparison, labels and evaluated values', async () => {
    const bundle = card(), issue = await failure(bundle);
    assert.equal(issue.code, 'action-precondition');
    assert.deepEqual(issue.condition, { kind: 'comparison', operator: 'gte',
        left: { kind: 'field', path: ['cash'], name: '现金', value: 102 }, right: { kind: 'value', value: 297 } });
    assert.equal(issue.actionTitle, bundle.definition.actions[0].title);
    bundle.definition.actions[0].requires = op('lte', { param: ['quantity'] }, literal(2));
    const parameter = (await failure(bundle)).condition;
    assert.ok(parameter?.kind === 'comparison');
    assert.deepEqual(parameter.left, { kind: 'parameter', path: ['quantity'], name: '数量', value: 99 });
});

// D2: alternatives and negation must not reverse the requirement or invent a
// function's internal failure (a player is told to perform the wrong repair).
test('D2: or lists alternatives, not reverses requirements, functions stay opaque', async () => {
    const bundle = card(), action = bundle.definition.actions[0];
    action.requires = op('or', op('gte', get('cash'), literal(297)), op('not', get('locked')));
    const issue = await failure(bundle), condition = issue.condition;
    assert.ok(condition?.kind === 'any');
    assert.equal(condition.conditions.length, 2);
    assert.deepEqual(condition.conditions[1], { kind: 'value', operand: { kind: 'field', path: ['locked'], name: 'locked', value: true }, expected: false });
    action.requires = op('not', op('lt', get('cash'), literal(297)));
    assert.deepEqual((await failure(bundle)).condition, condition.conditions[0]);
    action.requires = op('not', op('and', op('gte', get('cash'), literal(100)), get('locked')));
    const negated = (await failure(bundle)).condition;
    assert.ok(negated?.kind === 'any');
    assert.equal((negated.conditions[0] as Extract<Condition, { kind: 'comparison' }>).operator, 'lt');
    action.requires = { call: 'route', args: [] };
    assert.deepEqual((await failure(bundle)).condition, { kind: 'function', id: 'route', description: bundle.definition.functions.route.description, expected: true });
    // Failure explanations follow the same short circuit, never reading an inactive missing function argument.
    action.requires = op('and', literal(false), op('gt', get('missing'), literal(0)));
    assert.equal((await failure(bundle)).code, 'action-precondition');
});

// D3: parameter diagnostics retain names and constraints as structured data, and
// keep original validator evidence (protocol loss would make correction impossible).
test('D3: invalid parameters preserve names, paths, keyword values and raw errors', async () => {
    const bundle = card();
    for (const [params, keyword, expected] of [
        [{ quantity: 100 }, 'maximum', { comparison: '<=', limit: 99 }],
        [{ quantity: 0 }, 'minimum', { comparison: '>=', limit: 1 }],
        [{}, 'required', { missingProperty: 'quantity' }],
        [{ quantity: '2' }, 'type', { type: 'integer' }],
    ] as const) {
        const issue = await failure(bundle, params);
        assert.equal(issue.code, 'action-parameters');
        assert.deepEqual(issue.parameters?.[0], { keyword, path: ['quantity'], name: '数量', params: expected });
        assert.ok(Array.isArray(issue.errors) && issue.errors.length);
    }
    bundle.definition.actions[0].parameters = { type: 'object', required: ['routes'], additionalProperties: false, properties: {
        routes: { type: 'array', items: { type: 'object', required: ['actor'], properties: { actor: { $ref: '#/$defs/actor' } }, additionalProperties: false } },
    }, $defs: { actor: { type: 'string', title: '行动者', enum: ['a', 'b'] } } };
    const nested = await failure(bundle, { routes: [{ actor: 'c' }] });
    assert.deepEqual(nested.parameters?.[0], { keyword: 'enum', path: ['routes', '0', 'actor'], name: '行动者', params: { allowedValues: ['a', 'b'] } });
});
