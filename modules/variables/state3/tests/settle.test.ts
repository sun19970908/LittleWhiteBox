import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentExample } from '../definition/example.js';
import { compileDefinition } from '../definition/compile.js';
import { initialize, settle } from '../engine/settle.js';
import { getAt } from '../engine/data.js';
import { accepted } from './fixture.js';
import type { Json, JsonObject, Path } from '../types.js';
const action = (id: string) => ({ action: id, params: {} });
const set = (path: Path, value: Json) => ({ op: 'set', path, value });

test('K1/K2/K6: equipment settles one isolated candidate; annotations do not affect execution', async () => {
    const compiled = compileDefinition(equipmentExample()), initial = accepted(await initialize(compiled));
    const before = structuredClone(initial.state);
    const result = accepted(await settle(compiled, initial.state, [{ ...action('unequip'), reason: '故事中卸下护符', old: 'not a precondition', '备注': 1 }]));
    assert.deepEqual(initial.state, before);
    assert.equal(getAt(result.state, ['hero', 'amulet']), false);
    assert.equal(getAt(result.state, ['hero', 'maxHealth']), getAt(result.state, ['hero', 'baseHealth']));
    assert.equal(getAt(result.state, ['hero', 'health']), getAt(result.state, ['hero', 'maxHealth']));
    assert.ok(result.provenance.some(change => change.source.kind === 'derive'));
    assert.ok(result.provenance.some(change => change.source.kind === 'correct'));
    assert.equal((await settle(compiled, result.state, [action('unequip')])).ok, false);
});

test('K2/K3/K4: direct and ancestor writes cannot bypass restricted descendants; failed batches never publish', async () => {
    const bundle = equipmentExample(), compiled = compileDefinition(bundle), { state } = accepted(await initialize(compiled));
    const before = structuredClone(state), hero = getAt(state, ['hero']) as JsonObject;
    for (const input of [
        [set(['hero', 'health'], 1), set(['hero', 'amulet'], false)],
        [set(['hero'], { ...hero, amulet: false })], [set(['hero'], { ...hero, maxHealth: 1 })],
        [action('unequip'), action('unequip')], [action('unequip'), set(['hero', 'health'], -1)],
    ]) {
        const result = await settle(compiled, state, input);
        assert.equal(result.ok, false); assert.equal(Object.hasOwn(result, 'state'), false); assert.deepEqual(state, before);
    }
    bundle.definition.access.unshift({ path: ['hero'], direct: false, description: 'Locked parent' });
    assert.equal((await settle(compileDefinition(bundle), state, [set(['hero', 'future'], 1)])).ok, false);
});

test('K1: the first action after a rule change reads values calculated by the current rules', async () => {
    const { state } = accepted(await initialize(compileDefinition(equipmentExample())));
    const bundle = equipmentExample(), definition = bundle.definition;
    definition.rules[0].value = { op: 'add', args: [{ get: ['hero', 'baseHealth'] }, { op: 'if', args: [{ get: ['hero', 'amulet'] }, { literal: 80 }, { literal: 0 }] }] };
    definition.actions.push({ id: 'heal', title: 'Heal', parameters: { type: 'object', additionalProperties: false, properties: {} }, conversions: [], description: 'Restore full health.', requires: { literal: true }, effects: [{ path: ['hero', 'health'], value: { get: ['hero', 'maxHealth'] } }] });
    const result = accepted(await settle(compileDefinition(bundle), state, [action('heal')]));
    assert.equal(getAt(result.state, ['hero', 'maxHealth']), 140);
    assert.equal(getAt(result.state, ['hero', 'health']), 140);
});

test('K1/K4: direct batch validates its final state; definition cycles and aborted computation fail cleanly', async () => {
    const bundle = equipmentExample(), compiled = compileDefinition(bundle), { state } = accepted(await initialize(compiled));
    const result = accepted(await settle(compiled, state, [set(['hero', 'health'], -1), set(['hero', 'health'], getAt(state, ['hero', 'health'])!)]));
    assert.deepEqual(result.state, state);
    const controller = new AbortController(); controller.abort();
    assert.equal((await settle(compiled, state, [action('unequip')], { signal: controller.signal })).ok, false);
    bundle.definition.rules[0].value = { get: ['hero', 'condition'] };
    assert.throws(() => compileDefinition(bundle), { code: 'dependency-cycle' });
    const conflict = equipmentExample(); conflict.definition.rules.push({ ...conflict.definition.rules[0], id: 'second-writer' });
    assert.throws(() => compileDefinition(conflict), { code: 'rule-write-conflict' });
});
