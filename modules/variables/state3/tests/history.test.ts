import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentExample } from '../definition/example.js';
import { applyDifference, difference, makeReceipt, restore, rewind } from '../runtime/history.js';
import { getAt } from '../engine/data.js';
import { accepted, fixture } from './fixture.js';
const unequip = [{ action: 'unequip', params: {} }];

test('K10: pending persistence cannot block successive swipe or tail restoration', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    const initial = host.saved().history!.state, gate = host.holdNextSave();
    const pending = host.service.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]);
    await gate.started;
    const entries = host.saved().records[0].entries;
    try {
        const alternate = host.service.restoreSelection(entries).then(result => ({ result }), error => ({ error }));
        assert.deepEqual(accepted(await host.service.inspect()).state, initial);
        assert.ok('result' in await alternate);
        await host.service.restoreSelection([], entries);
        assert.equal(getAt(accepted(await host.service.inspect()).state, ['hero', 'health']), 20);
        await host.service.restoreSelection(entries);
        assert.deepEqual(accepted(await host.service.inspect()).state, initial);
    } finally { gate.release(); await pending; }
    assert.deepEqual(accepted(await host.service.inspect()).state, initial);
});

test('K4/K5/K6: preview and rejected batch leave storage untouched; confirmed effects undo and reopen without rules', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    const original = host.saved();
    accepted(await host.service.preview(unequip)); assert.deepEqual(host.saved(), original);
    const committed = accepted(await host.service.apply(unequip)), branch = host.saved();
    assert.equal((await host.service.apply(unequip)).ok, false); assert.deepEqual(host.saved(), branch);
    const reopened = fixture(); reopened.load(branch);
    assert.deepEqual(accepted(await reopened.service.inspect()).state, committed.state);
    accepted(await reopened.service.undo());
    assert.deepEqual(accepted(await reopened.service.inspect()).state, original.history!.state);
    const broken = host.saved(); broken.history!.bundle.definition.actions = [];
    reopened.load(broken); accepted(await reopened.service.undo());
    assert.deepEqual(accepted(await reopened.service.inspect()).state, original.history!.state);
});

test('K5: current state survives missing middle records; selection restoration never executes actions', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    accepted(await host.service.apply(unequip));
    let data = host.saved(); data.records.push({ entries: [] }); host.load(data);
    accepted(await host.service.apply([{ action: 'equip', params: {} }]));
    data = host.saved(); const selected = data.records[1].entries;
    data.records.splice(0, 1); host.load(data);
    assert.equal(getAt(accepted(await host.service.inspect()).state, ['hero', 'amulet']), true);
    const before = host.saved();
    assert.equal((await host.service.inspect()).ok, true); assert.deepEqual(host.saved(), before);
    await host.service.restoreSelection(selected);
    assert.equal(getAt(accepted(await host.service.inspect()).state, ['hero', 'amulet']), false);
    await host.service.restoreSelection([], selected);
    assert.equal(getAt(accepted(await host.service.inspect()).state, ['hero', 'amulet']), true);
});

test('K5/K7: redoing a reply replaces its prior settlement; stale targets cannot publish', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    accepted(await host.service.apply(unequip, { source: 'model' }));
    accepted(await host.service.apply(unequip, { source: 'model' }));
    assert.equal(host.saved().records[0].entries.length, 1);
    const staged = await host.service.stage(); host.switch();
    await assert.rejects(staged.run([], { preview: false }), { code: 'stale-target' });
    host.failSave();
    const result = accepted(await host.service.apply([{ op: 'set', path: ['hero', 'health'], value: 3 }]));
    assert.equal(result.committed, true); assert.equal(result.saved, false);
    assert.equal(getAt(accepted(await host.service.inspect()).state, ['hero', 'health']), 3);
});

test('K5/storage: array element changes are bounded; insert/delete/mixed changes round-trip exactly', () => {
    const inventory = Array.from({ length: 1000 }, (_, i) => ({ name: 'item-' + i, count: 3 }));
    const before = { inventory }, after = structuredClone(before); after.inventory[500].count--;
    const delta = difference(before, after);
    const small = difference({ inventory: inventory.slice(0, 501) }, { inventory: after.inventory.slice(0, 501) });
    assert.equal(JSON.stringify(delta).length, JSON.stringify(small).length);
    // Action inputs can contain large selections too; history owns effects, not another input copy.
    const receipt = makeReceipt({ before, revision: 1, result: {
        ok: true, state: after, diagnostics: [], changes: [], provenance: [],
        actions: [{ id: 'consume', params: { selected: inventory } }],
    } });
    assert.deepEqual(receipt.actions, [{ id: 'consume' }]);
    assert.ok(JSON.stringify(receipt).length < 1000);
    const removed = inventory.slice(); removed.splice(50, 1);
    const inserted = inventory.slice(); inserted.splice(50, 0, { name: 'new', count: 1 });
    for (const next of [after, { inventory: removed }, { inventory: inserted }, { inventory: [...after.inventory, { name: 'new', count: 1 }] }, { inventory: [] }]) {
        const change = difference(before, next);
        assert.deepEqual(applyDifference(before, change), next);
        assert.deepEqual(applyDifference(next, change, true), before);
        assert.deepEqual(restore(next, [{ id: 'stored', revision: 1, source: 'api', changes: change, actions: [] }], true), before);
    }
});

test('K5: long chats retain two periodic checkpoints and restore a tail without rules or per-floor snapshots', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    for (let floor = 1; floor <= 152; floor++) {
        const data = host.saved(); data.records.push({ entries: [] }); host.load(data);
        // Alternating user and AI messages must not miss checkpoint boundaries.
        if (floor % 2 === 0) {accepted(await host.service.apply([{ op: 'set', path: ['hero', 'health'], value: floor % 37 }]));}
    }
    const data = host.saved(), history = data.history!, point = history.checkpoints.at(-1)!;
    assert.equal(history.checkpoints.length, 2);
    const suffix = data.records.flatMap(record => record.entries).filter(entry => entry.revision > point.revision);
    assert.deepEqual(rewind(history, suffix), point.state);
    assert.deepEqual(rewind(history, suffix), restore(history.state, suffix, true));
    assert.ok(data.records.every(record => record.entries.every(entry => !Object.hasOwn(entry, 'state'))));
});
