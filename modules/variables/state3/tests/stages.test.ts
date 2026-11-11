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

function dualCard() {
    const bundle = equipmentExample(); bundle.definition.updates = ['before', 'after'];
    for (const action of bundle.definition.actions) {action.stages = ['before'];}
    for (const entry of bundle.definition.access) {if (entry.write.includes('direct')) {entry.stages = ['after'];}}
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
        assert.equal(rejected.ok, false); assert.equal(rejected.diagnostics[0].code, 'stage-permission');
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

// B2: the USER result is durable and replacement/undo is not a second increment;
// later confirmed effects are preserved, never causally replayed (data loss).
test('B2: before receipt replacement, reload and explicit undo preserve the known history contract', async () => {
    const f = fixture(), bundle = equipmentExample(); bundle.definition.updates = ['before'];
    accepted(await f.service.enable(bundle));
    const input = [{ op: 'inc', path: ['hero', 'health'], delta: -10 }];
    const options = { index: 0, stage: 'before' as const, source: 'model:before', replaceSource: 'model:before',
        beforeUpdate: { inputDigest: 'player-message', outcome: 'applied' as const, diagnostics: [] } };
    const staged = await f.service.stage(options);
    const preview = accepted(await staged.run(input, { stage: 'before' }));
    const applied = accepted(await staged.run(input, { ...options, preview: false }));
    assert.deepEqual(applied.state, preview.state);
    const reopened = f.saved(); f.load(reopened);
    assert.deepEqual(beforeOutcome(reopened.records[0].entries[0]).changes, applied.changes);
    assert.deepEqual(accepted(await f.service.apply(input, options)).state, applied.state);
    accepted(await f.service.recordBefore(0, { inputDigest: 'player-message', outcome: 'undone', diagnostics: [] }));
    assert.equal((f.saved().state as { hero: { health: number } }).hero.health, 80);
    assert.equal(f.saved().records[0].entries[0].beforeUpdate!.outcome, 'undone');
    assert.equal(f.saved().records[0].entries.length, 1);
    accepted(await f.service.apply(input, options));
    const saved = f.saved(); saved.records.push({ entries: [] }); f.load(saved);
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 30 }], { index: 1 }));
    accepted(await f.service.recordBefore(0, { inputDigest: 'player-message', outcome: 'undone', diagnostics: [] }));
    assert.equal((f.saved().state as { hero: { health: number } }).hero.health, 30);
    // Replacing the latest USER still preserves its later AI receipt. Report a
    // conflict if that preserved result no longer fits, rather than rewriting it.
    accepted(await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 90 }], { index: 1 }));
    const changed = accepted(await f.service.apply([{ action: 'unequip', params: {} }], options));
    assert.equal((changed.state as { hero: { health: number } }).hero.health, 90);
    assert.equal(changed.restoration![0].code, 'constraint');
});
