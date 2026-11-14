import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from 'jsondiffpatch';
import { difference, applyDifference } from '../engine/difference.js';
import { encodeDeltaValue, decodeDeltaValue } from '../engine/delta-data.js';
import { displayChanges } from '../engine/delta-view.js';
import { makeReceipt, rebase, restore } from '../runtime/history.js';
import { fixture, accepted } from './fixture.js';
import type { Bundle, Json } from '../types.js';

const bundle = (initial: Bundle['definition']['initial']): Bundle => ({
    definition: { format: 1, updates: ['after'], name: 'delta contract', schema: {}, initial,
        access: Object.keys(initial).map(key => ({ path: [key], direct: true, description: key })),
        rules: [], actions: [], constraints: [], functions: {}, views: {} }, functions: {},
});
test('K5: receipt source labels do not replace effects unless replacement is explicitly requested', async () => {
    const host = fixture(); accepted(await host.service.enable(bundle({ counter: 0 })));
    const input = [{ op: 'inc', path: ['counter'], delta: 1 }];
    accepted(await host.service.apply(input, { source: 'model' }));
    accepted(await host.service.apply(input, { source: 'model' }));
    assert.deepEqual(host.saved().state, { counter: 2 });
    assert.equal(host.saved().records[0].entries.length, 2);
    accepted(await host.service.apply(input, { source: 'model', replace: true }));
    assert.deepEqual(host.saved().state, { counter: 1 });
    assert.equal(host.saved().records[0].entries.length, 1);
});

test('K5: undo removes the last target transaction and every subsequent floor without rebasing', async () => {
    const host = fixture(); accepted(await host.service.enable(bundle({ counter: 0 })));
    accepted(await host.service.apply([{ op: 'inc', path: ['counter'], delta: 1 }]));
    accepted(await host.service.apply([{ op: 'inc', path: ['counter'], delta: 2 }]));
    const saved = host.saved(); saved.records.push({ entries: [] }); host.load(saved);
    accepted(await host.service.apply([{ op: 'inc', path: ['counter'], delta: 4 }]));
    const first = host.saved().records[0].entries[0];
    accepted(await host.service.undo({ index: 0 }));
    assert.deepEqual(host.saved().state, { counter: 1 });
    assert.deepEqual(host.saved().records.map(record => record.entries), [[first], []]);
    host.load(JSON.parse(JSON.stringify(host.saved())));
    accepted(await host.service.undo({ index: 0 }));
    assert.deepEqual(host.saved().state, { counter: 0 });
    assert.ok(host.saved().records.every(record => record.entries.length === 0));
});

const receipt = (before: Json, state: Json) => makeReceipt({ before, revision: 1,
    result: { ok: true, state, changes: [], provenance: [], actions: [], diagnostics: [] } });

test('K18/K5: persisted library deltas round-trip arbitrary JSON types, keys, duplicates and nested array edits', () => {
    const values: Json[] = [null, false, 0, '123', 'true', 'null', '[1,2]', '{"_t":"a"}', '中文\n😀',
        {}, { '0': [1], _t: 'a', '~_t': 'text', 'a/b~c': { '': true } },
        [], [1, 1, 2], [2, 1, 1], ['anchor', [1, 2]], ['new', 'anchor', [1, 3]],
        [{ n: 1, keep: 'x' }, { n: 2 }], [{ n: 2 }, { n: 1, keep: 'x' }]];
    const library = create();
    for (const old of values) {for (const next of values) {
        const before = { root: old }, after = { root: next };
        const saved = JSON.parse(JSON.stringify(difference(before, after)));
        assert.deepEqual(applyDifference(before, saved), after);
        assert.deepEqual(applyDifference(after, saved, true), before);
        assert.deepEqual(decodeDeltaValue(library.patch(encodeDeltaValue(before), structuredClone(saved) ?? undefined) as Json), after);
        const entry = receipt(before, after);
        assert.deepEqual(rebase(before, [entry]), after);
        assert.deepEqual(restore(after, [entry], true), before);
        assert.deepEqual(before, { root: old });
        assert.deepEqual(after, { root: next });
    }}
});

test('K18/K13: mixed array edits retain field-level changes without storing unchanged large text or other elements', () => {
    const before = { bag: Array.from({ length: 1000 }, (_, index) => ({ label: 'item-' + index, count: 1, text: '留'.repeat(500) })) };
    const after = structuredClone(before);
    after.bag.shift(); after.bag[500].count = 2; after.bag.push({ label: 'new', count: 1, text: '' });
    const delta = difference(before, after), shown = displayChanges(delta);
    assert.ok(JSON.stringify(delta).length < 1400);
    assert.ok(shown.some(change => change.path.join('.') === 'bag.500.count' && change.before === 1 && change.after === 2));
    assert.equal(shown.some(change => change.path.join('.') === 'bag.500.text'), false);
    assert.deepEqual(applyDifference(before, delta), after);
    assert.deepEqual(applyDifference(after, delta, true), before);
    assert.deepEqual(rebase(before, [receipt(before, after)]), after);
    assert.deepEqual(displayChanges(difference({ bag: [1, 2] }, { bag: [1, 3] })), [{ path: ['bag', '1'], before: 2, after: 3, removed: false }]);
    const keys = displayChanges(difference({ root: { _t: 'a', '0': '123' } }, { root: { _t: 'b', '0': 'true' } }));
    assert.deepEqual(keys.map(change => change.path.at(-1)).sort(), ['0', '_t']);
});

test('K18/K16: shifted nested arrays survive repeated selection, save/reopen and tail undo without resurrecting creator fields', async () => {
    const host = fixture();
    accepted(await host.service.enable(bundle({ bag: ['anchor', [1, 2]], people: {}, text: '123' })));
    accepted(await host.service.apply([
        { op: 'set', path: ['bag'], value: ['new', 'anchor', [1, 3]] },
        { op: 'set', path: ['people'], value: { '0': { affinity: 10, obsolete: 'old' } } },
    ]));
    let data = host.saved(); const first = data.records[0].entries; data.records.push({ entries: [] }); host.load(data);
    accepted(await host.service.apply([{ op: 'set', path: ['people', '0', 'affinity'], value: 11 }]));
    const full = accepted(await host.service.inspect()).state;
    for (let repeat = 0; repeat < 3; repeat++) {
        const later = host.saved().records[1].entries;
        await host.service.restoreSelection([...first, ...later], later);
        assert.deepEqual(accepted(await host.service.inspect()).state, { bag: ['anchor', [1, 2]], people: { '0': { affinity: 11 } }, text: '123' });
        await host.service.restoreSelection(host.saved().records[1].entries, [...first, ...later]);
        assert.deepEqual(accepted(await host.service.inspect()).state, full);
    }
    const later = host.saved().records[1].entries;
    await host.service.restoreSelection([...first, ...later], later);
    data = JSON.parse(JSON.stringify(host.saved()));
    data.records[0].entries = []; host.load(data);
    accepted(await host.service.undo());
    assert.deepEqual(accepted(await host.service.inspect()).state, { bag: ['anchor', [1, 2]], people: {}, text: '123' });
});

test('K16: absent deletions do not create containers; retained array positions use null and remain reversible', () => {
    for (const [before, after, start, expected] of [
        [{ root: { gone: { x: 1 } } }, { root: { gone: {} } }, { root: {} }, { root: {} }],
        [{ root: [1, 2, 3] }, { root: [1, 2, 4] }, { root: [] }, { root: [null, null, 4] }],
        [{ root: [1, 2, 3] }, { root: [1, 3] }, { root: [] }, { root: [] }],
        [{ root: [{ x: 1 }, { x: 2 }, { x: 3 }] }, { root: [{ x: 1 }, { x: 2 }, {}] }, { root: [] }, { root: [] }],
        [{ root: [{ x: 1 }, { x: 2 }, { x: 3 }] }, { root: [{ x: 1 }, { x: 2 }, {}] }, { root: [{ x: 9 }] }, { root: [{ x: 9 }] }],
        [{ root: [{ nested: { x: 1 } }] }, { root: [{ nested: {} }] }, { root: [] }, { root: [] }],
        [{ root: [[1, 2], [3, 4]] }, { root: [[1, 2], [3]] }, { root: [[]] }, { root: [[]] }],
        [{ root: [{ n: 1 }, { x: 1 }] }, { root: [{ n: 2 }, {}] }, { root: [] }, { root: [{ n: 2 }] }],
        [{ root: ['anchor', { x: 1 }] }, { root: ['new', 'anchor', {}] }, { root: [] }, { root: ['new'] }],
        [{ root: ['gone', 'anchor', { x: 1 }] }, { root: ['anchor', {}] }, { root: [{ x: 9 }] }, { root: [] }],
        [{ root: ['gone', 'anchor', { x: 1 }] }, { root: ['anchor', {}] }, { root: ['other', { x: 7 }, { x: 9 }] }, { root: [{ x: 7 }, {}] }],
        [{ root: [{ obsolete: 'x' }, { n: 1, obsolete: 'x' }] }, { root: [{ obsolete: 'x' }, { n: 2, obsolete: 'x' }] }, { root: {} }, { root: [null, { n: 2 }] }],
    ] as [Json, Json, Json, Json][]) {
        const entry = receipt(before, after), result = rebase(start, [entry]);
        assert.deepEqual(result, expected);
        assert.deepEqual(restore(result, [entry], true), start);
        assert.deepEqual(restore(start, [entry]), result);
    }
});

test('K16/K18: explicit undo and replacement discard the suffix while native selection retains reversible effects', async () => {
    const host = fixture(), rules = bundle({ list: [] });
    rules.definition.schema = { type: 'object', properties: { list: { type: 'array', items: {
        type: 'object', properties: { x: { type: 'number' } }, additionalProperties: false,
    } } }, required: ['list'], additionalProperties: false };
    accepted(await host.service.enable(rules));
    accepted(await host.service.apply([{ op: 'set', path: ['list'], value: [{ x: 1 }, { x: 2 }, { x: 3 }] }]));
    const created = host.saved(); created.records.push({ entries: [] }); host.load(created);
    accepted(await host.service.apply([{ op: 'remove', path: ['list', '2', 'x'] }]));
    const confirmed = host.saved();
    for (const route of ['undo', 'replace', 'swipe']) {
        host.load(confirmed);
        if (route === 'undo') {accepted(await host.service.undo({ index: 0, all: true }));}
        else if (route === 'replace') {
            accepted(await host.service.apply([{ op: 'set', path: ['list'], value: [] }], { index: 0, replace: true }));
        } else {
            const alternate = host.saved(); alternate.records[0].entries = []; host.load(alternate);
            await host.service.restoreSelection(confirmed.records.flatMap(record => record.entries), confirmed.records[1].entries);
        }
        assert.deepEqual(host.saved().state, { list: [] }, route);
        if (route !== 'swipe') {assert.equal(host.saved().records[1].entries.length, 0, route);}
        host.load(JSON.parse(JSON.stringify(host.saved())));
        assert.deepEqual(accepted(await host.service.apply([])).state, { list: [] }, route);
        accepted(await host.service.undo({ index: 1, all: true }));
        assert.deepEqual(host.saved().state, { list: [] }, route);
    }
});
