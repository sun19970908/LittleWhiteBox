import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { equipmentExample } from '../definition/example.js';
import { getAt } from '../engine/data.js';
import { showResult } from '../ui/result.js';
import { accepted, fixture } from './fixture.js';
import { compileDefinition } from '../definition/compile.js';
import { validateState } from '../engine/validation.js';

// R1: historical swipes restore recorded effects, warn on conflicts, and still allow a repairing batch.
// Cost: silently invalid saved state or a chat that cannot be repaired.
test('R1: restored conflicts are read-only diagnostics, not rejected restores or a submission lock', async () => {
    const host = fixture(), bundle = equipmentExample();
    bundle.definition = { ...bundle.definition, schema: {}, initial: { key: false, door: false, reward: 0 },
        access: [{ path: ['key'], direct: true, description: '钥匙' }, { path: ['door'], direct: true, description: '门' }],
        rules: [], actions: [], triggers: [], views: {}, constraints: [{ id: 'door-key', description: '开门必须持有钥匙',
            test: { op: 'or', args: [{ op: 'not', args: [{ get: ['door'] }] }, { get: ['key'] }] } }] };
    accepted(await host.service.enable(bundle));
    accepted(await host.service.apply([{ op: 'set', path: ['key'], value: true }]));
    let saved = host.saved(); saved.records.push({ entries: [] }); host.load(saved);
    accepted(await host.service.apply([{ op: 'set', path: ['door'], value: true }]));
    saved = host.saved();
    const previous = saved.records.flatMap(record => record.entries), later = saved.records[1].entries;
    saved.records[0].entries = []; host.load(saved);
    // Neither a correction nor a reward may run during restoration.
    bundle.definition.rules = [{ id: 'repair', kind: 'correct', path: ['key'], description: '测试修正', value: { literal: true } }];
    bundle.definition.triggers = [{ id: 'reward', description: '测试奖励', when: { get: ['door'] }, effects: [{ path: ['reward'], value: { literal: 1 } }] }];
    host.setCard(bundle);
    const pending = host.service.restoreSelection(previous, later, { check: true });
    assert.deepEqual(host.saved().state, { key: false, door: true, reward: 0 }, 'restore publishes before async validation/persistence');
    const result = accepted((await pending)!);
    assert.equal(result.saved, true);
    assert.equal(result.restoration?.[0].rule, 'door-key');
    assert.deepEqual(result.restoration?.[0].fields, [{ path: ['door'], value: true }, { path: ['key'], value: false }]);
    assert.deepEqual(result.changes, [{ path: ['key'], before: true, after: false, removed: false }]);
    bundle.definition.rules = []; bundle.definition.triggers = []; host.setCard(bundle);
    const before = host.saved();
    assert.equal((await host.service.apply([])).ok, false); assert.deepEqual(host.saved(), before);
    accepted(await host.service.apply([{ op: 'set', path: ['key'], value: true }]));
    assert.equal(getAt(host.saved().state, ['door']), true);
});

// R2: the live recovery result must describe its actual diff, even when that state violates a constraint.
// Cost: invisible state changes / a false claim that the restore did not take effect.
test('R2: recovery changes and validation diagnostics remain distinct from historical settlement results', async () => {
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    accepted(await host.service.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    const result = accepted((await host.service.restoreSelection(host.saved().records[0].entries, [], { check: true }))!);
    assert.deepEqual(result.restoration, []);
    assert.deepEqual(result.changes, [{ path: ['hero', 'health'], before: 20, after: 80, removed: false }]);
    const { document, Event } = parseHTML('<html><body><main></main></body></html>');
    const prior = globalThis.document; globalThis.document = document;
    try {
        const root = document.querySelector('main')!;
        const expand = () => { const group = root.querySelector('details')!; group.open = true; group.dispatchEvent(new Event('toggle')); };
        showResult(root, result);
        expand();
        assert.equal(root.querySelectorAll('.lwb-state3-change').length, 1);
        result.restoration = [{ code: 'constraint', rule: 'rule', description: '作者规则', fields: [{ path: ['hero', 'health'], value: 80 }] }];
        showResult(root, result);
        expand();
        assert.equal(root.querySelectorAll('[role="alert"]').length, 1);
        assert.equal(root.querySelectorAll('.lwb-state3-change').length, 1);
    } finally { globalThis.document = prior; }
});

// R5: a historical restore cannot invent a batch baseline and report a valid transition as a conflict.
// Cost: false rule failures that mislead the player into undoing correct state.
test('R5: restoration skips unavailable before reads, but still checks current state and real batches', async () => {
    for (const useFunction of [false, true]) {
        const host = fixture(), bundle = equipmentExample();
        bundle.definition = { ...bundle.definition, schema: {}, initial: { flag: false, coins: 100, spent: 0 },
            access: ['flag', 'coins', 'spent'].map(key => ({ path: [key], direct: true, description: key })),
            rules: [], actions: [], triggers: [], views: {}, functions: {}, constraints: [{ id: 'spent', description: '本次花费与金币减少量一致',
                test: { op: 'eq', args: [{ get: ['spent'] }, { op: 'subtract', args: [{ before: ['coins'] }, { get: ['coins'] }] }] } },
            { id: 'balance', description: '金币不能为负', test: { op: 'gte', args: [{ get: ['coins'] }, { literal: 0 }] } }] };
        if (useFunction) {
            bundle.definition.functions = { spending: { reads: [['spent'], ['coins']], description: '核对本次花费' } };
            bundle.functions = { spending: '(_, {get, before}) => get(["spent"]) === before(["coins"]) - get(["coins"])' };
            bundle.definition.constraints[0].test = { call: 'spending', args: [] };
        }
        accepted(await host.service.enable(bundle));
        accepted(await host.service.apply([{ op: 'set', path: ['flag'], value: true }]));
        let saved = host.saved(); saved.records.push({ entries: [] }); host.load(saved);
        accepted(await host.service.apply([{ op: 'inc', path: ['coins'], delta: -10 }, { op: 'set', path: ['spent'], value: 10 }]));
        saved = host.saved(); const previous = saved.records.flatMap(record => record.entries), next = saved.records[1].entries;
        saved.records[0].entries = []; host.load(saved);
        const restored = accepted((await host.service.restoreSelection(previous, next, { check: true }))!);
        assert.deepEqual(restored.state, { flag: false, coins: 90, spent: 10 });
        assert.deepEqual(restored.restoration, []);
        assert.equal((await host.service.apply([{ op: 'inc', path: ['coins'], delta: -1 }])).ok, false);
        const compiled = compileDefinition(bundle);
        const diagnostics = await validateState(compiled, { bundle, state: { flag: false, coins: -1, spent: 10 }, params: {} });
        assert.deepEqual(diagnostics.map(issue => issue.rule), ['balance']);
    }
});
