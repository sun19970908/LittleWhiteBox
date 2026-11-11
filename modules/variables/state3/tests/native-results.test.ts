import test from 'node:test';
import type { JsonObject } from '../types.js';
import assert from 'node:assert/strict';
import { equipmentExample } from '../definition/example.js';
import { readVariables, writeVariables, variableRoots } from '../runtime/variables.js';
import { difference, applyDifference } from '../runtime/history.js';
import { displayChanges } from '../engine/delta-view.js';
import { accepted, fixture } from './fixture.js';

test('K11: native roots preserve neighbors, scalar types and deletions; metadata has no second current state', async () => {
    const bundle = equipmentExample(), roots = variableRoots(bundle.definition);
    const variables: Record<string, unknown> = { other: 'untouched', hero: JSON.stringify(bundle.definition.initial.hero) };
    const host = fixture();
    host.load({ state: readVariables(variables), records: [{ entries: [] }] });
    const enabled = accepted(await host.service.enable(bundle));
    writeVariables(variables, enabled.state as JsonObject, roots);
    assert.equal(variables.other, 'untouched');
    assert.deepEqual(readVariables(variables, roots), enabled.state);
    assert.equal(Object.hasOwn(host.saved().history!, 'state'), false);
    writeVariables(variables, {}, roots);
    assert.deepEqual(variables, { other: 'untouched' });
    for (const value of [0, false, true, null, '', '123', 'true', 'null', '{"x":1}', '[1,2]', '"quoted"', { nested: [1, true] }]) {
        writeVariables(variables, { owned: value }, ['owned']);
        assert.deepEqual(readVariables(variables, ['owned']), { owned: value });
    }
});

test('K13: long mixed edits, duplicates and nested objects round-trip without unchanged array contents', () => {
    const before = { bag: Array.from({ length: 1000 }, (_, index) => ({ id: index, count: 1 })) };
    const after = { bag: [...before.bag.slice(1), { id: 1000, count: 2 }] };
    const delta = difference(before, after);
    assert.equal(displayChanges(delta).length, 4);
    assert.ok(JSON.stringify(delta).length < 400);
    assert.deepEqual(applyDifference(before, delta), after);
    assert.deepEqual(applyDifference(after, delta, true), before);
    assert.ok(displayChanges(delta).every(change => !Array.isArray(change.before) && !Array.isArray(change.after)));
    const arrays = [[], ['a'], ['a', 'a'], ['b', 'a', 'b'], ['a', 'b', 'a'], [{ x: 1 }, { x: 2 }]];
    for (const left of arrays) { for (const right of arrays) {
        const changes = difference(left, right);
        assert.deepEqual(applyDifference(left, changes), right);
        assert.deepEqual(applyDifference(right, changes, true), left);
    } }
});

test('K13: input annotations retain original positions and never enter stored history', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    const result = accepted(await host.service.apply([
        { op: 'set', path: ['hero', 'health'], value: 40, reason: 'first', old: 12345, custom: { evidence: 'note' } },
        { op: 'set', path: ['hero', 'health'], value: 45, reason: 'second' },
    ]));
    assert.deepEqual(result.annotations?.map(item => item.index), [0, 1]);
    assert.equal(result.changes.find(change => change.path.at(-1) === 'health')?.before, 80);
    assert.equal(JSON.stringify(host.saved()).includes('12345'), false);
    assert.equal(JSON.stringify(host.saved()).includes('evidence'), false);
    const reopened = fixture(); reopened.load(host.saved());
    assert.equal(accepted(await reopened.service.inspect()).annotations, undefined);
});
