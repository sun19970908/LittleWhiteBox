import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDefinition } from '../definition/compile.js';
import { initialize, settle } from '../engine/settle.js';
import { getAt } from '../engine/data.js';
import { accepted, fixture } from './fixture.js';
import type { Bundle, Expression, Json, Trigger } from '../types.js';

const literal = (value: Json): Expression => ({ literal: value });
const get = (key: string): Expression => ({ get: [key] });
const op = (name: string, ...args: Expression[]): Expression => ({ op: name, args });
function purchaseCard(): Bundle {
    return { definition: {
        format: 1, updates: ['after'], name: 'Action contract',
        schema: { type: 'object', required: ['coins', 'items', 'claimed', 'health'], additionalProperties: false,
            properties: { coins: { type: 'number', minimum: 0 }, items: { type: 'integer', minimum: 0 }, claimed: { type: 'boolean' }, health: { type: 'number', minimum: 0 } } },
        initial: { coins: 20, items: 0, claimed: false, health: 10 },
        access: [
            { path: ['coins'], direct: false, description: 'Paid by purchase' },
            { path: ['items'], direct: false, description: 'Received by purchase' },
            { path: ['health'], direct: false, description: 'Changed by an action' },
        ], rules: [], constraints: [{ id: 'affordable', description: 'No debt', test: op('gte', get('coins'), literal(0)) }],
        functions: { quantity: { reads: [], description: 'Normalize a numeric quantity' } }, views: {},
        actions: [
            { id: 'buy', title: 'Purchase', description: 'Pay and receive items together',
                parameters: { type: 'object', required: ['quantity'], additionalProperties: false, properties: { quantity: { type: 'integer', minimum: 1 } } },
                conversions: [{ path: ['quantity'], value: { call: 'quantity', args: [{ param: ['quantity'] }] } }],
                requires: op('gte', get('coins'), op('multiply', { param: ['quantity'] }, literal(5))),
                effects: [
                    { path: ['coins'], value: op('subtract', get('coins'), op('multiply', { param: ['quantity'] }, literal(5))) },
                    { path: ['items'], value: op('add', get('items'), { param: ['quantity'] }) },
                ] },
            ...(['hurt', 'heal'] as const).map(id => ({ id, title: id, description: id,
                parameters: { type: 'object', additionalProperties: false, properties: {} }, conversions: [], requires: literal(true),
                effects: [{ path: ['health'], value: literal(id === 'hurt' ? 0 : 10) }],
            })),
        ], triggers: [{ id: 'gift', description: 'First purchase reward',
            when: op('and', op('gte', get('items'), literal(2)), op('not', get('claimed'))),
            effects: [{ path: ['coins'], value: op('add', get('coins'), literal(1)) }, { path: ['claimed'], value: literal(true) }] }],
    }, functions: { quantity: '(input) => Number(input[0])' } };
}

test('K1/K4/K5: conversion, purchase and first reward are atomic and recoverable; next action sees settled state', async () => {
    const bundle = purchaseCard(), host = fixture(); accepted(await host.service.enable(bundle));
    const initial = host.saved();
    const input = [{ action: 'buy', params: { quantity: '2' } }];
    const result = accepted(await host.service.apply(input));
    assert.equal(getAt(result.state, ['claimed']), true);
    assert.equal(result.provenance.some(item => item.source.id === 'gift'), true);
    const first = host.saved();
    accepted(await host.service.undo()); assert.deepEqual(host.saved().state, initial.state);
    host.load(first); assert.deepEqual(accepted(await host.service.inspect()).state, result.state);
    const rejected = await host.service.apply([{ action: 'buy', params: { quantity: 1 } }, { action: 'buy', params: { quantity: 2 } }]);
    assert.equal(rejected.ok, false); assert.deepEqual(host.saved(), first);
    const repeated = accepted(await host.service.apply([{ action: 'buy', params: { quantity: 1 } }]));
    assert.equal(repeated.provenance.some(item => item.source.id === 'gift'), false);
    assert.equal(getAt(repeated.state, ['coins']), Number(getAt(result.state, ['coins'])) - 5);
});

test('K4/K5: trigger timing is authored; repeated triggers reach stability rather than silently running once', async () => {
    for (const timing of ['batch', 'action'] as const) {
        const bundle = purchaseCard();
        bundle.definition.triggers = [{ id: 'near-death', timing, description: 'Remember near death', when: op('eq', get('health'), literal(0)), effects: [{ path: ['claimed'], value: literal(true) }] }];
        const compiled = compileDefinition(bundle), initial = accepted(await initialize(compiled));
        const result = accepted(await settle(compiled, initial.state, [{ action: 'hurt', params: {} }, { action: 'heal', params: {} }]));
        assert.equal(getAt(result.state, ['claimed']), timing === 'action');
    }
    const bundle = purchaseCard();
    bundle.definition.triggers = [{ id: 'installments', description: 'Process all installments', when: op('lt', get('items'), literal(4)), effects: [{ path: ['items'], value: op('add', get('items'), literal(1)) }] }];
    const result = accepted(await initialize(compileDefinition(bundle)));
    assert.equal(result.provenance.filter(item => item.source.id === 'installments').length, 4);
});

test('K4: oscillating and non-repeating runaway triggers reject with their rule chain and preserve stored state', async () => {
    const variants: Trigger[][] = [
        [{ id: 'toggle', description: 'Oscillate', when: literal(true), effects: [{ path: ['claimed'], value: op('not', get('claimed')) }] }],
        [{ id: 'runaway', description: 'Unbounded increment', when: literal(true), effects: [{ path: ['items'], value: op('add', get('items'), literal(1)) }] }],
    ];
    const base = purchaseCard(), start = accepted(await initialize(compileDefinition(base))).state;
    for (const triggers of variants) {
        const bundle = purchaseCard(); bundle.definition.triggers = triggers;
        const before = structuredClone(start), result = await settle(compileDefinition(bundle), start, []);
        assert.equal(result.ok, false); assert.deepEqual(start, before);
        assert.equal(result.diagnostics[0].code, triggers[0].id === 'toggle' ? 'trigger-cycle' : 'trigger-limit');
        assert.deepEqual(result.diagnostics[0].rules, triggers.map(item => item.id));
    }
});
