import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentExample } from '../definition/example.js';
import { compileDefinition } from '../definition/compile.js';
import { canWriteDirect } from '../definition/stages.js';
import { initialize, settle } from '../engine/settle.js';
import { accepted, fixture } from './fixture.js';
import type { JsonObject, UpdateStage } from '../types.js';

// F1: the first rejection identifies a forbidden direct write even without op;
// removing it permits the remaining batch, with no partial writes or extra save.
test('F1: forbidden input reports its permission before operands, without applying the other actions', async () => {
    const f = fixture(), bundle = equipmentExample();
    bundle.definition.access[1].direct = false;
    accepted(await f.service.enable(bundle));
    const actions = [{ action: 'unequip', params: {} }, { action: 'equip', params: {} }];
    const batch = [...actions, { path: ['hero', 'health'], value: 40 }];
    const original = structuredClone(batch), saved = f.saved(), counts = f.counts();
    for (const last of [batch[2], { ...batch[2], op: 'set' }]) {
        const result = await f.service.apply([...actions, last], { stage: 'after' });
        assert.equal(result.ok, false);
        const issue = result.diagnostics[0];
        assert.equal(issue.code, 'direct-not-allowed'); assert.equal(issue.operation, 2);
        assert.deepEqual(issue.path, ['hero', 'health']);
        assert.equal(issue.message, undefined);
        assert.ok(!result.ok);
        assert.deepEqual(result.items?.map(item => item.status), ['static-passed', 'static-passed', 'rejected']);
        assert.deepEqual(result.items?.map(item => item.item), [...actions, last]);
        assert.deepEqual(f.saved(), saved); assert.deepEqual(f.counts(), counts);
    }
    assert.deepEqual(batch, original);
    const corrected = accepted(await f.service.apply(actions, { stage: 'after' }));
    assert.equal(((corrected.state as JsonObject).hero as JsonObject).health, 60);
    assert.equal(f.counts().saves, counts.saves + 1);
});

// F2: field ownership, computed values and stage assignment need different repairs.
// Rejections report the restriction without duplicating the guide's action list.
test('F2: direct-write diagnostics distinguish ownership, derivation and stage', async () => {
    const bundle = equipmentExample(); bundle.definition.updates = ['before', 'after'];
    bundle.definition.actions[0].stages = ['before']; bundle.definition.actions[1].stages = ['after'];
    bundle.definition.access[1].stages = ['after'];
    const compiled = compileDefinition(bundle), start = accepted(await initialize(compiled)).state;
    for (const stage of ['before', 'after'] as const) {
        const issue = (await settle(compiled, start, [{ path: ['hero', 'amulet'], value: false }], { stage })).diagnostics[0];
        assert.equal(issue.code, 'direct-not-allowed');
        assert.equal(issue.relatedActions, undefined); assert.equal(issue.actions, undefined);
    }
    const stageIssue = (await settle(compiled, start, [{ path: ['hero', 'health'], value: 70 }], { stage: 'before' })).diagnostics[0];
    assert.equal(stageIssue.code, 'direct-other-stage'); assert.deepEqual(stageIssue.allowedStages, ['after']);
    const wrongAction = (await settle(compiled, start, [{ action: 'equip', params: {} }], { stage: 'before' })).diagnostics[0];
    assert.equal(wrongAction.code, 'action-other-stage'); assert.deepEqual(wrongAction.allowedStages, ['after']);
    const derived = (await settle(compiled, start, [{ path: ['hero', 'maxHealth'], value: 120 }], { stage: 'after' })).diagnostics[0];
    assert.equal(derived.code, 'derived-write'); assert.equal(derived.rule, 'health-limit');
    assert.equal(derived.relatedActions, undefined);
    const malformed = (await settle(compiled, start, [{ path: ['hero', 'health'], value: 70 }], { stage: 'after' })).diagnostics[0];
    assert.equal(malformed.code, 'input-shape');
    const path = (await settle(compiled, start, [{ path: 'hero.health', value: 70 }], { stage: 'before' })).diagnostics[0];
    assert.equal(path.code, 'path');
    const multiple = await settle(compiled, start, [{ action: 'absent', params: {} }, { path: ['hero', 'health'], value: 70 }], { stage: 'after' });
    assert.deepEqual(multiple.diagnostics.map(issue => [issue.code, issue.operation]), [['action-missing', 0], ['input-shape', 1]]);
});

// F3: feedback must not narrow the accepted inputs. Explicit-stage path checks
// and unstaged APIs' actual-change checks retain their different existing scopes.
test('F3: nested restrictions, dynamic paths, whole-object writes and no-ops retain their permissions', async () => {
    const bundle = equipmentExample();
    bundle.definition.initial = { bag: { fixed: 1, coins: 10 } };
    bundle.definition.schema = { type: 'object', properties: { bag: { type: 'object', additionalProperties: { type: 'number' } } } };
    bundle.definition.rules = []; bundle.definition.actions = []; bundle.definition.constraints = []; bundle.definition.views = {};
    bundle.definition.access = [
        { path: ['bag'], direct: true, description: 'Bag.' },
        { path: ['bag', 'fixed'], direct: false, description: 'Fixed.' },
    ];
    const compiled = compileDefinition(bundle), start = accepted(await initialize(compiled)).state;
    for (const [input, staged, unstaged] of [
        [{ op: 'set', path: ['bag', 'coins'], value: 20 }, true, true],
        [{ op: 'set', path: ['bag', 'new'], value: 2 }, true, true],
        [{ op: 'set', path: ['bag'], value: { fixed: 1, coins: 20 } }, false, true],
        [{ op: 'set', path: ['bag', 'fixed'], value: 1 }, false, true],
        [{ op: 'set', path: ['bag', 'fixed'], value: 2 }, false, false],
        [{ op: 'remove', path: ['bag'] }, false, false],
    ] as const) {
        assert.equal(canWriteDirect(compiled.definition, [...input.path], 'after'), staged);
        for (const stage of ['after', undefined] as (UpdateStage | undefined)[]) {
            const result = await settle(compiled, start, [input], { stage });
            assert.equal(result.ok, stage ? staged : unstaged, JSON.stringify({ input, stage, result }));
        }
    }
    const broken = await settle(compiled, start, [{ op: 'set', path: ['bag', 'coins'], value: 20 }, { op: 'inc', path: ['bag', 'fixed'], delta: 1 }]);
    assert.equal(broken.diagnostics[0].code, 'direct-not-allowed'); assert.equal(broken.diagnostics[0].operation, 1);
});

// F4: a dynamic failure stops execution; later items are not certified and no
// earlier effect reaches memory, receipts or storage (state corruption).
test('F4: sequential rejection reports passed, rejected and unchecked without committing', async () => {
    const f = fixture(); accepted(await f.service.enable(equipmentExample()));
    const before = f.saved(), counts = f.counts();
    const batch = [{ action: 'unequip', params: {} }, { action: 'unequip', params: {} }, { action: 'equip', params: {} }];
    const result = await f.service.apply(batch, { stage: 'after' });
    assert.ok(!result.ok);
    assert.deepEqual(result.items?.map(item => item.status), ['passed', 'rejected', 'unchecked']);
    assert.deepEqual(result.items?.map(item => item.item), batch);
    assert.equal(result.items?.[1].diagnostics?.[0].code, 'action-precondition');
    assert.deepEqual(f.saved(), before); assert.deepEqual(f.counts(), counts);
    accepted(await f.service.apply([batch[0], batch[2]], { stage: 'after' }));
    assert.equal(f.counts().saves, counts.saves + 1);
});

// F5: final-state rules belong to the whole batch, not to its last operation.
test('F5: final constraints remain batch diagnostics after individual operations pass', async () => {
    const bundle = equipmentExample(), f = fixture();
    bundle.definition.constraints = [{ id: 'minimum-health', description: 'Health minimum.',
        test: { op: 'gte', args: [{ get: ['hero', 'health'] }, { literal: 50 }] } }];
    accepted(await f.service.enable(bundle));
    const before = f.saved();
    const result = await f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 40 }, { op: 'inc', path: ['hero', 'health'], delta: -1 }], { stage: 'after' });
    assert.ok(!result.ok);
    assert.deepEqual(result.items?.map(item => item.status), ['passed', 'passed']);
    assert.deepEqual(result.diagnostics.map(issue => issue.rule), ['minimum-health']);
    assert.ok(result.diagnostics.every(issue => issue.operation === undefined));
    assert.deepEqual(f.saved(), before);
});

// F6: independent parameter errors are reported together; conversion-dependent
// parameters remain valid after earlier operations change the conversion's inputs.
test('F6: static parameter checks collect errors without rejecting values before conversion', async () => {
    const bundle = equipmentExample(), action = bundle.definition.actions[0];
    action.parameters = { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } };
    let compiled = compileDefinition(bundle);
    const start = accepted(await initialize(compiled)).state;
    const bad = await settle(compiled, start, [{ action: 'unequip', params: { amount: 'auto' } }, { path: ['hero', 'amulet'], value: false }], { stage: 'after' });
    assert.deepEqual(bad.diagnostics.map(issue => [issue.code, issue.operation]), [['action-parameters', 0], ['direct-not-allowed', 1]]);
    action.conversions = [{ path: ['amount'], value: { get: ['hero', 'health'] } }];
    compiled = compileDefinition(bundle);
    const batch = [{ op: 'set', path: ['hero', 'health'], value: 50 }, { action: 'unequip', params: { amount: 'auto' } }];
    const copy = structuredClone(batch);
    const result = accepted(await settle(compiled, start, batch, { stage: 'after' }));
    assert.equal(result.actions[0].params?.amount, 50);
    assert.deepEqual(batch, copy);
});
