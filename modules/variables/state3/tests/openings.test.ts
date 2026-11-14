import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDefinition } from '../definition/compile.js';
import { initialState } from '../definition/openings.js';
import { initialize, checkOpenings } from '../engine/settle.js';
import { accepted } from './fixture.js';
import type { Bundle } from '../types.js';

// The opening fragment taught in the user guide, with its ordinary shared schema.
function travel(): Bundle {
    return { definition: {
        format: 1, name: 'Journey', updates: ['after'],
        schema: { type: 'object', required: ['hero'], additionalProperties: false, properties: {
            hero: { type: 'object', required: ['place', 'coins', 'items'], additionalProperties: false, properties: {
                place: { type: 'string' }, coins: { type: 'integer', minimum: 0 }, items: { type: 'array', items: { type: 'string' } },
            } },
        } },
        initial: { hero: { place: '营地', coins: 30, items: ['背包'] } },
        openings: [{}, { hero: { place: '港口', coins: 80, items: ['船票'] } }],
        access: [{ path: ['hero'], direct: true, description: 'Travel state.' }],
        rules: [], actions: [], constraints: [], functions: {}, views: {},
    }, functions: {} };
}

test('opening order selects starting values under one shared schema', async () => {
    const bundle = travel(), compiled = compileDefinition(bundle), original = structuredClone(bundle);
    assert.deepEqual(accepted(await initialize(compiled)).state, { hero: { place: '营地', coins: 30, items: ['背包'] } });
    assert.deepEqual(accepted(await initialize(compiled, { opening: 1 })).state, { hero: { place: '港口', coins: 80, items: ['船票'] } });
    assert.deepEqual(accepted(await initialize(compiled, { opening: 2 })).state, bundle.definition.initial);
    assert.deepEqual(bundle, original);
});

test('opening objects inherit fields; lists, scalar values and null replace whole values', () => {
    const bundle = travel();
    bundle.definition.initial = { hero: { stats: { health: 20, coins: 30 }, items: ['old', 'extra'], quest: { id: 1 } } };
    bundle.definition.openings = [{ hero: { stats: { coins: 0 }, items: [], quest: null } }];
    const state = initialState(bundle.definition);
    assert.deepEqual(state, { hero: { stats: { health: 20, coins: 0 }, items: [], quest: null } });
    (state.hero as { items: string[] }).items.push('new');
    assert.deepEqual((bundle.definition.initial.hero as { items: string[] }).items, ['old', 'extra']);
    assert.deepEqual((bundle.definition.openings[0].hero as { items: string[] }).items, []);
    for (const opening of [-1, 1.5, NaN]) {assert.throws(() => initialState(bundle.definition, opening), { code: 'opening-index' });}
});

test('opening data cannot add unmanaged roots or bypass shared validation', async () => {
    const bundle = travel();
    bundle.definition.openings![1] = { foreign: { coins: 80 } };
    assert.throws(() => compileDefinition(bundle), { code: 'unowned-root' });
    bundle.definition.openings![1] = { hero: { coins: -1 } };
    const compiled = compileDefinition(bundle);
    accepted(await initialize(compiled));
    const checked = await checkOpenings(compiled);
    assert.equal(checked.ok, false);
    if (!checked.ok) {
        assert.equal(checked.diagnostics[0].code, 'state-schema');
        assert.equal(checked.diagnostics[0].opening, 1);
    }
    bundle.definition.openings![1] = { hero: { coins: 80 } };
    bundle.definition.constraints = [{ id: 'travel-budget', description: 'Keep enough money for the trip.',
        test: { op: 'lte', args: [{ get: ['hero', 'coins'] }, { literal: 50 }] } }];
    const constraint = await checkOpenings(compileDefinition(bundle));
    assert.equal(constraint.ok, false);
    if (!constraint.ok) {assert.equal(constraint.diagnostics[0].opening, 1); assert.equal(constraint.diagnostics[0].code, 'constraint');}
});

test('the shared fallback remains a valid start even when every listed opening overrides it', async () => {
    const bundle = travel();
    bundle.definition.initial.hero = { place: '营地', coins: -1, items: [] };
    bundle.definition.openings = [{ hero: { coins: 30 } }, { hero: { coins: 80 } }];
    const compiled = compileDefinition(bundle);
    accepted(await initialize(compiled));
    const checked = await checkOpenings(compiled);
    assert.equal(checked.ok, false);
    if (!checked.ok) {assert.deepEqual(checked.diagnostics[0].path, ['initial']);}
});

test('every opening recomputes derived state and checks common triggers', async () => {
    const bundle = travel();
    bundle.definition.schema = {};
    bundle.definition.initial.hero = { coins: 30, rewarded: false };
    bundle.definition.openings = [{}, { hero: { coins: 80 } }];
    bundle.definition.rules = [{ id: 'budget', kind: 'derive', path: ['hero', 'budget'], description: 'Budget after fares.',
        value: { op: 'subtract', args: [{ get: ['hero', 'coins'] }, { literal: 10 }] } }];
    bundle.definition.triggers = [{ id: 'welcome', description: 'One welcome gift.',
        when: { op: 'not', args: [{ get: ['hero', 'rewarded'] }] }, effects: [
            { path: ['hero', 'coins'], value: { op: 'add', args: [{ get: ['hero', 'coins'] }, { literal: 5 }] } },
            { path: ['hero', 'rewarded'], value: { literal: true } },
        ] }];
    assert.deepEqual(accepted(await initialize(compileDefinition(bundle), { opening: 1 })).state,
        { hero: { coins: 85, rewarded: true, budget: 75 } });
});
