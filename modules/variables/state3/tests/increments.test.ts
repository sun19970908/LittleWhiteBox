import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { parseHTML } from 'linkedom';
import { compileDefinition } from '../definition/compile.js';
import { settle } from '../engine/settle.js';
import { getInputSchema } from '../model/tools.js';
import { showResult } from '../ui/result.js';
import { accepted, fixture } from './fixture.js';
import type { Bundle, Json, JsonObject } from '../types.js';

// Acceptance contracts (invisible state corruption / protocol mismatch):
// I1: increments use the current candidate in order, with existing rule timing.
// I2: invalid numeric inputs, forbidden writes and invalid final states publish nothing.
// I3: tool and runtime input shapes agree; annotations cannot affect arithmetic.
// I4: corrections retain the event reason and show the actual change and rule source.
// I5: previews, replacement, correction, restoration and reopening never repeat an increment.
const inc = (delta: Json, path = ['hero', 'coins']) => ({ op: 'inc', path, delta });
const set = (value: Json, path = ['hero', 'coins']) => ({ op: 'set', path, value });
const coins = (state: Json) => (state as { hero: { coins: number } }).hero.coins;
function shop(): Bundle {
    return { definition: {
        format: 1, updates: ['after'], name: 'Shop', schema: { type: 'object', required: ['hero'], additionalProperties: false, properties: {
            hero: { type: 'object', required: ['coins', 'stock', 'total', 'ready', 'claimed'], additionalProperties: false, properties: {
                coins: { type: 'integer', minimum: 0 }, stock: { type: 'integer', minimum: 0 }, total: { type: 'number' },
                ready: { type: 'boolean' }, claimed: { type: 'boolean' },
            } },
        } }, initial: { hero: { coins: 10, stock: 2, total: 20, ready: false, claimed: false } },
        access: [
            { path: ['hero', 'coins'], direct: true, description: 'Coins. Selling grants 5 automatically; direct changes cover separate income or spending.' },
            { path: ['hero', 'stock'], direct: false, description: 'Sale inventory.' },
            { path: ['hero', 'total'], direct: false, description: 'Twice the coin balance.' },
            { path: ['hero', 'ready'], direct: true, description: 'Reward eligibility. Becoming eligible grants 5 once.' },
            { path: ['hero', 'claimed'], direct: false, description: 'Reward has been claimed.' },
        ],
        rules: [
            { id: 'cap', kind: 'correct', path: ['hero', 'coins'], description: 'Coins are capped at 100.', value: { op: 'min', args: [{ get: ['hero', 'coins'] }, { literal: 100 }] } },
            { id: 'total', kind: 'derive', path: ['hero', 'total'], description: 'Twice the coin balance.', value: { op: 'multiply', args: [{ get: ['hero', 'coins'] }, { literal: 2 }] } },
        ],
        actions: [{ id: 'sell', title: 'Sell', description: 'Sell one item and receive 5 coins automatically.', parameters: { type: 'object', properties: {}, additionalProperties: false }, conversions: [],
            requires: { op: 'gt', args: [{ get: ['hero', 'stock'] }, { literal: 0 }] }, effects: [
                { path: ['hero', 'stock'], value: { op: 'subtract', args: [{ get: ['hero', 'stock'] }, { literal: 1 }] } },
                { path: ['hero', 'coins'], value: { op: 'add', args: [{ get: ['hero', 'coins'] }, { literal: 5 }] } },
            ] }],
        triggers: [{ id: 'reward', description: 'Eligibility grants 5 coins once.', when: { op: 'and', args: [{ get: ['hero', 'ready'] }, { op: 'not', args: [{ get: ['hero', 'claimed'] }] }] }, effects: [
            { path: ['hero', 'coins'], value: { op: 'add', args: [{ get: ['hero', 'coins'] }, { literal: 5 }] } },
            { path: ['hero', 'claimed'], value: { literal: true } },
        ] }], constraints: [], functions: {}, views: { wallet: { paths: [['hero', 'coins']], description: 'Wallet' } },
    }, functions: {} };
}

test('I1: direct increments observe prior edits, actions and triggers without changing rule timing', async () => {
    const bundle = shop(), compiled = compileDefinition(bundle), start = bundle.definition.initial;
    for (const [input, expected] of [
        [[set(20), inc(5), inc(-3)], 22],
        [[set(90), inc(20), inc(-20)], 90],
        [[inc(0.5), inc(0.5), inc(0)], 11],
        [[{ action: 'sell', params: {} }], 15],
        [[set(true, ['hero', 'ready'])], 15],
        [[inc(2), { action: 'sell', params: {} }, inc(3), set(true, ['hero', 'ready'])], 25],
    ] as [unknown[], number][]) {
        assert.equal(coins(accepted(await settle(compiled, start, input)).state), expected);
    }
    assert.equal(coins(start), 10);
});

test('I2: malformed, missing, nonnumeric and overflowing increments fail without partial publication', async () => {
    const host = fixture(); accepted(await host.service.enable(shop()));
    for (const operation of [
        { op: 'inc', path: ['hero', 'coins'] }, inc('5'), inc(null), inc(true), inc([]), inc({}), inc(NaN), inc(Infinity),
        inc(1, ['hero', 'absent']), inc(1, ['hero', 'ready']), inc(1, ['hero', 'stock']), inc(1, ['hero', 'total']),
        inc(-100), inc(2.5),
    ]) {
        const before = host.saved();
        const result = await host.service.apply([inc(1), operation]);
        assert.equal(result.ok, false, JSON.stringify(operation));
        assert.deepEqual(host.saved(), before);
        if (('delta' in operation && operation.delta === '5') || operation.path.at(-1) === 'absent') {
            assert.equal(result.diagnostics[0].operation, 1); assert.deepEqual(result.diagnostics[0].path, operation.path);
        }
    }
    const bundle = shop(); bundle.definition.rules = []; (bundle.definition.initial.hero as JsonObject).coins = Number.MAX_VALUE;
    const result = await settle(compileDefinition(bundle), bundle.definition.initial, [inc(Number.MAX_VALUE)]);
    assert.equal(result.ok, false); assert.equal(coins(bundle.definition.initial), Number.MAX_VALUE);
    for (const value of ['10', null, {}, []]) {
        (bundle.definition.initial.hero as JsonObject).coins = value;
        assert.equal((await settle(compileDefinition(bundle), bundle.definition.initial, [inc(1)])).ok, false);
    }
    bundle.definition.access.unshift({ path: ['hero'], direct: false, description: 'Locked parent.' });
    (bundle.definition.initial.hero as JsonObject).coins = 10;
    assert.equal((await settle(compileDefinition(bundle), bundle.definition.initial, [inc(1)])).ok, false);
});

test('I3: tool schema and runtime accept the same increment shape and distinguish operands from notes', async () => {
    const bundle = shop(), compiled = compileDefinition(bundle), validate = new Ajv({ strict: false }).compile(getInputSchema(compiled));
    for (const delta of [-2, 0, 2, 0.5]) { assert.equal(validate([inc(delta)]), true); }
    // Forbidden paths are covered by I2 at settlement, not by provider schemas.
    for (const operation of [{ op: 'inc', path: ['hero', 'coins'] }, inc('2'), inc(null)]) {
        assert.equal(validate([operation]), false);
    }
    const result = accepted(await settle(compiled, bundle.definition.initial, [{ ...inc(5), reason: 'Sold an item elsewhere.', old: 999 }]));
    assert.equal(coins(result.state), 15);
    assert.deepEqual(result.annotations?.[0].fields, [['reason', 'Sold an item elsewhere.'], ['old', 999]]);
    // Documentation example: optional notes and the array path are accepted unchanged.
    assert.equal(validate([{ op: 'inc', path: ['hero', 'coins'], delta: 5, reason: 'Sold an item elsewhere.' }]), true);
});

test('I3: dynamic numeric paths and array elements use the same input contract', async () => {
    const bundle = shop(); bundle.definition.rules = []; bundle.definition.actions = []; bundle.definition.triggers = [];
    bundle.definition.schema = { type: 'object', properties: { hero: { type: 'object', additionalProperties: { type: 'number' } }, bag: { type: 'array', items: { type: 'number' } } } };
    bundle.definition.initial = { hero: { 'Lv.3': 1 }, bag: [2] };
    bundle.definition.access = ['hero', 'bag'].map(key => ({ path: [key], direct: true, description: key }));
    const compiled = compileDefinition(bundle), input = [inc(2, ['hero', 'Lv.3']), inc(-1, ['bag', '0']), set(0, ['hero', 'newCounter']), inc(3, ['hero', 'newCounter'])];
    assert.equal(new Ajv({ strict: false }).compile(getInputSchema(compiled))(input), true);
    assert.deepEqual(accepted(await settle(compiled, bundle.definition.initial, input)).state, { hero: { 'Lv.3': 3, newCounter: 3 }, bag: [1] });
});

test('I4: a capped increment preserves the event reason and exposes the actual result and correction source', async () => {
    const bundle = shop(); (bundle.definition.initial.hero as JsonObject).coins = 98;
    const result = accepted(await settle(compileDefinition(bundle), bundle.definition.initial, [{ ...inc(5), reason: 'Received 5 coins.' }]));
    assert.equal(coins(result.state), 100);
    assert.deepEqual(result.changes.find(change => change.path.at(-1) === 'coins'), { path: ['hero', 'coins'], before: 98, after: 100, removed: false });
    assert.ok(result.provenance.some(change => change.source.kind === 'correct' && change.source.id === 'cap'));
    assert.deepEqual(result.annotations?.[0].fields, [['reason', 'Received 5 coins.']]);
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
        const { document } = parseHTML('<html><body><main></main></body></html>');
        Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
        const root = document.querySelector('main')!;
        showResult(root as unknown as HTMLElement, result, bundle.definition);
        assert.equal(root.querySelector('.lwb-state3-reason')?.textContent, result.annotations?.[0].fields[0][1]);
    } finally {
        if (previous) { Object.defineProperty(globalThis, 'document', previous); } else { Reflect.deleteProperty(globalThis, 'document'); }
    }
});

test('I5: previews, failed correction, replacement, restoration and reopening cannot double count', async () => {
    const host = fixture(); accepted(await host.service.enable(shop())); const before = host.saved();
    accepted(await host.service.preview([inc(5)])); assert.deepEqual(host.saved(), before);
    const stage = await host.service.stage({ replace: true });
    assert.equal((await stage.run([inc('5')], { preview: true })).ok, false); assert.deepEqual(host.saved(), before);
    accepted(await stage.run([inc(5)], { preview: true })); assert.deepEqual(host.saved(), before);
    accepted(await stage.run([inc(5)], { preview: false, source: 'model' }));
    await assert.rejects(stage.run([inc(5)], { preview: false }), { code: 'stage-consumed' });
    accepted(await host.service.apply([inc(5)], { source: 'model', replace: true }));
    assert.equal(coins(host.saved().state), 15); assert.equal(host.saved().records[0].entries.length, 1);
    const entries = host.saved().records[0].entries;
    await host.service.restoreSelection(entries); assert.equal(coins(host.saved().state), 10);
    await host.service.restoreSelection([], entries); assert.equal(coins(host.saved().state), 15);
    const reopened = fixture(); reopened.load(host.saved()); assert.equal(coins(accepted(await reopened.service.inspect()).state), 15);
    accepted(await reopened.service.undo()); assert.equal(coins(reopened.saved().state), 10);
    accepted(await reopened.service.apply([inc(5)])); accepted(await reopened.service.apply([inc(5)]));
    assert.equal(coins(reopened.saved().state), 20);
});
