import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { equipmentExample } from '../definition/example.js';
import { compileDefinition } from '../definition/compile.js';
import { getInputSchema } from '../model/tools.js';
import { buildUpdateView } from '../model/views.js';
import { initialize, settle } from '../engine/settle.js';
import { fixture, accepted } from './fixture.js';
import { beforeOutcome } from '../runtime/before-result.js';

// B13: a replacement preview is harmless, but committing even an invalid new
// submission first persists removal of the old suffix rather than preserving it.
test('B13: replacement preview is read-only and rejected replacement stays at the saved rollback', async () => {
    const f = fixture(); accepted(await f.service.enable(equipmentExample()));
    const initial = f.saved().state;
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 70 }], { source: 'model' }));
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 65 }]));
    const saved = f.saved(); saved.records.push({ entries: [] }); f.load(saved);
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 30 }], { index: 1 }));
    const before = f.saved(), saves = f.counts().saves;
    const staged = await f.service.stage({ index: 0, replace: true });
    accepted(await staged.run([{ op: 'inc', path: ['hero', 'health'], delta: -10 }]));
    assert.deepEqual(f.saved(), before); assert.equal(f.counts().saves, saves);
    const gate = f.holdNextSave();
    let finished = false;
    const replacing = staged.run([{ op: 'inc', path: ['hero', 'health'], delta: 'invalid' }], { preview: false, source: 'model' })
        .then(result => {finished = true; return result;});
    try {
        await gate.started;
        assert.deepEqual(f.saved().state, initial);
        assert.ok(f.saved().records.every(record => record.entries.length === 0));
        assert.equal(finished, false);
    } finally {gate.release();}
    assert.equal((await replacing).ok, false);
    assert.equal(f.counts().saves, saves + 1);
    assert.deepEqual(f.saved().state, initial);
    assert.ok(f.saved().records.every(record => record.entries.length === 0));
});

function dualCard() {
    const bundle = equipmentExample(); bundle.definition.updates = ['before', 'after'];
    for (const action of bundle.definition.actions) {action.stages = ['before'];}
    for (const entry of bundle.definition.access) {if (entry.direct) {entry.stages = ['after'];}}
    return bundle;
}

// B1: tool exposure and runtime stage permissions agree; a mixed-stage batch
// never partly applies (duplicate resource changes / model protocol mismatch).
test('B1: stages restrict tools, instructions and whole submissions, not shared rules or card APIs', async () => {
    const bundle = dualCard(), compiled = compileDefinition(bundle), start = accepted(await initialize(compiled));
    const before = buildUpdateView(compiled, start.state, 'before'), after = buildUpdateView(compiled, start.state, 'after');
    assert.equal(before.writable.length, 0); assert.equal(after.actions.length, 0);
    assert.equal(after.fields.find(entry => entry.path.at(-1) === 'amulet')!.update, undefined);
    assert.deepEqual(before.rules, after.rules); assert.deepEqual(before.constraints, after.constraints);
    const validateBefore = new Ajv({ strict: false }).compile(getInputSchema(compiled, 'before'));
    const validateAfter = new Ajv({ strict: false }).compile(getInputSchema(compiled, 'after'));
    const action = { action: 'unequip', params: {} }, edit = { op: 'inc', path: ['hero', 'health'], delta: -5 };
    assert.ok(validateBefore([action])); assert.equal(validateBefore([edit]), false);
    assert.ok(validateAfter([edit])); assert.equal(validateAfter([action]), false);
    for (const stage of ['before', 'after'] as const) {
        const rejected = await settle(compiled, start.state, [action, edit], { stage });
        assert.equal(rejected.ok, false); assert.equal(rejected.diagnostics[0].code, stage === 'before' ? 'direct-other-stage' : 'action-other-stage');
    }
    assert.equal((accepted(await settle(compiled, start.state, [action], { stage: 'before' })).state as { hero: { health: number } }).hero.health, 60);
    assert.ok((await settle(compiled, start.state, [action, edit])).ok);
    delete bundle.definition.actions[0].stages;
    assert.throws(() => compileDefinition(bundle), { code: 'stage-missing' });
    bundle.definition.updates = ['after'];
    bundle.definition.actions.forEach(action => { delete action.stages; });
    const single = compileDefinition(bundle);
    assert.equal((await settle(single, start.state, [], { stage: 'before' })).diagnostics[0].code, 'stage-disabled');
});

// B2: replacing a USER outcome discards the whole affected transaction suffix,
// including API edits and the latest AI outcome; no old effect can reappear after reload.
test('B2: USER recalculation durably rolls back its whole floor and every later receipt', async () => {
    const f = fixture(), bundle = equipmentExample(); bundle.definition.updates = ['before'];
    accepted(await f.service.enable(bundle));
    const initial = f.saved().state;
    const input = [{ op: 'inc', path: ['hero', 'health'], delta: -10 }];
    const options = { index: 0, stage: 'before' as const, source: 'model:before', replace: true,
        beforeUpdate: { inputDigest: 'player-message', outcome: 'applied' as const, diagnostics: [] } };
    const staged = await f.service.stage(options);
    const preview = accepted(await staged.run(input, { stage: 'before' }));
    const applied = accepted(await staged.run(input, { ...options, preview: false }));
    assert.deepEqual(applied.state, preview.state);
    const reopened = f.saved(); f.load(reopened);
    assert.deepEqual(beforeOutcome(reopened.records[0].entries[0]).changes, applied.changes);
    assert.deepEqual(accepted(await f.service.apply(input, options)).state, applied.state);
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 65 }], { index: 0 }));
    const saved = f.saved(); saved.records.push({ entries: [] }); f.load(saved);
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 30 }], { index: 1 }));
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 90 }], { index: 1 }));
    const oldIds = f.saved().records.flatMap(record => record.entries.map(entry => entry.id));
    const saves = f.counts().saves;
    const rolledBack = accepted(await f.service.rollback({ index: 0 }));
    assert.equal(rolledBack.saved, true);
    assert.equal(f.counts().saves, saves + 1);
    assert.deepEqual(f.saved().state, initial);
    assert.ok(f.saved().records.every(record => record.entries.length === 0));
    f.load(JSON.parse(JSON.stringify(f.saved())));
    const changed = accepted(await f.service.apply([{ action: 'unequip', params: {} }], options));
    assert.equal((changed.state as { hero: { health: number } }).hero.health, 60);
    assert.equal(f.saved().records[0].entries.length, 1);
    assert.equal(f.saved().records[1].entries.length, 0);
    assert.ok(f.saved().records.flatMap(record => record.entries).every(entry => !oldIds.includes(entry.id)));
    accepted(await f.service.undo({ index: 0, all: true }));
    assert.deepEqual(f.saved().state, initial);
});
