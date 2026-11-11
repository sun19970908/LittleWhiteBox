import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { resultDifference } from '../result-diff.js';
import { presentResult } from '../result.js';
import { renderUpdateResult } from '../result-view.js';

test('R1: results isolate actual additions, removals and nested edits without unchanged container copies', () => {
    const old = Array.from({ length: 1000 }, (_, index) => `item-${index}`);
    assert.deepEqual(resultDifference(old, [...old, { 任意字段: ['a', 1, null] }], '数据.列表'),
        [{ path: '数据.列表[1000]', kind: 'added', after: { 任意字段: ['a', 1, null] } }]);
    assert.deepEqual(resultDifference(['a', 'a', 'b'], ['a', 'b'], '数据.列表'), [{ path: '数据.列表[1]', kind: 'removed', before: 'a' }]);
    assert.deepEqual(resultDifference([1, 2, 3, 4], [1, 3, 5], '数据.列表'), [
        { path: '数据.列表[1]', kind: 'removed', before: 2 }, { path: '数据.列表[2]', kind: 'changed', before: 4, after: 5 },
    ]);
    assert.deepEqual(resultDifference({ 未改: old, 'a.b': { n: 10, gone: null }, 列表: [{ x: 1 }] },
        { 未改: old, 'a.b': { n: 11, added: false }, 列表: [{ x: 2 }] }, '数据'), [
        { path: '数据["a.b"].n', kind: 'changed', before: 10, after: 11 },
        { path: '数据["a.b"].gone', kind: 'removed', before: null },
        { path: '数据["a.b"].added', kind: 'added', after: false },
        { path: '数据.列表[0].x', kind: 'changed', before: 1, after: 2 },
    ]);
    assert.deepEqual(resultDifference([{ a: 1, b: 2 }], [{ b: 2, a: 1 }], '数据'), []);
    assert.deepEqual(resultDifference({ a: 1 }, null, '数据'), [{ path: '数据', kind: 'changed', before: { a: 1 }, after: null }]);
});

test('R2: custom fields are matched by operation index, distinct from real values and rendered as inert text', () => {
    const input = { 本轮判定: '已核对', ops: [
        { op: 'inc', path: '数据.数值', delta: 1, old: 999, 原因: '<img src=x onerror=alert(1)>' },
        { op: 'set', path: '数据.对象', value: { 原因: '这是真实变量' }, 自定义: ['x', 2] },
        { op: 'inc', path: '数据.数值', delta: 0, reason: '无需改动' },
    ] };
    const batch = presentResult({ changes: [
        { index: 1, path: '数据.对象', oldValue: { 原因: '原值' }, newValue: { 原因: '这是真实变量' } },
        { index: 0, path: '数据.数值', oldValue: 10, newValue: 11 },
    ] }, input);
    assert.deepEqual(presentResult({ changes: [] }, JSON.stringify(input)), presentResult({ changes: [] }, input));
    assert.deepEqual(batch.operations[0].changes[0], { path: '数据.数值', kind: 'changed', before: 10, after: 11 });
    assert.deepEqual(batch.operations[1].annotations, [['自定义', ['x', 2]]]);
    assert.deepEqual(batch.operations[2].changes, []);
    const { document } = parseHTML('<main></main>'); globalThis.document = document;
    try {
        renderUpdateResult({ batches: [batch], phase: 'success' }, document.querySelector('main'));
        assert.equal(document.querySelectorAll('img').length, 0);
        const notes = document.querySelectorAll('.xb-variable-annotations');
        assert.equal(notes.length, 4);
        assert.ok(notes[0].textContent.includes('999'));
        assert.ok(notes[2].textContent.includes('无需改动'));
    } finally { delete globalThis.document; }
});
