import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarness, readStoredValue } from './helpers/state2-harness.js';
import { parseJsonInput } from '../state2/json-input.js';
import { parsePath, formatPath } from '../state2/path.js';

// Acceptance (silent state corruption): distinct keys stay distinct in writes, guards and replay;
// v1 upgrades retain historical targets without replaying on open; annotation examples execute.
let h, api;
const key = 'LittleWhiteBox_state2';
const ctx = () => h.env.state.ctx;
const read = root => readStoredValue(ctx(), root);
const seed = text => api.applyText(`<state>\n${text}\n</state>`, { floor: 0 });
const set = (path, value) => api.apply({ ops: [{ op: 'set', path, value }] });
test.before(async () => { h = await createHarness(); });
test.beforeEach(() => {
    h.reset(); ctx().chat = [{ mes: 'init', swipe_id: 0 }, { mes: 'reply', swipe_id: 0 }];
    api = h.executor.createStateApi();
});
test.after(() => h.cleanup());

test('literal dots and nested paths never share readonly rules in either direction or whole-object writes', () => {
    const initial = { 'Lv.3': 1, Lv: { '3': 2 } };
    for (const [locked, open] of [['角色["Lv.3"]', '角色.Lv.3'], ['角色.Lv.3', '角色["Lv.3"]']]) {
        h.reset(); ctx().chat = [{ mes: 'init' }, { mes: 'reply' }]; api = h.executor.createStateApi();
        seed(`角色: ${JSON.stringify(initial)}`);
        seed(`$ro ${locked}`);
        assert.equal(set(open, 9).status, 'success');
        assert.equal(set(locked, 8).status, 'failed');
        const expected = read('角色');
        const whole = structuredClone(initial);
        if (open.includes('["')) whole['Lv.3'] = 7; else whole.Lv['3'] = 7;
        assert.equal(set('角色', whole).status, 'success');
        h.executor.rebuildStateV2(); assert.deepEqual(read('角色'), whole);
        assert.notDeepEqual(expected, whole);
    }
    seed('父: {"子":1}'); seed('$ro 父');
    assert.equal(set('父.子', 10).status, 'success', 'parent readonly semantics are unchanged');
});

test('schema literal keys, numeric keys, wildcards and missing containers share lossless paths', () => {
    assert.deepEqual(seed('$schema 数据\n  "Lv.3": 0\n  Lv:\n    "3": ""\n  字典: {}\n  列表: []\n数据: {"Lv.3":1,"Lv":{"3":"nested"},"字典":{},"列表":[]}').errors, []);
    assert.equal(set('数据["Lv.3"]', 3).status, 'success');
    assert.equal(set('数据.Lv.3', 4).status, 'failed');
    assert.equal(set('数据.字典.物品.0', '药水').status, 'success');
    assert.equal(set('数据.字典.编号["00"]', '编号').status, 'success');
    assert.equal(set('数据.字典.编号["0"]', '零').status, 'success');
    assert.equal(set('数据.列表[0]', 'first').status, 'success');
    assert.equal(set('数据.列表["00"]', 'bad').status, 'failed');
    const expected = read('数据');
    assert.deepEqual(expected.字典, { 物品: ['药水'], 编号: { '00': '编号', '0': '零' } });
    assert.deepEqual(expected.列表, ['first']);
    h.executor.rebuildStateV2(); assert.deepEqual(read('数据'), expected);
    for (const parts of [['数据', 'a.b', '00'], ['数据', 'a"b', 0], ['数据', 'a\\b'], ['数据', '*']]) {
        assert.deepEqual(parsePath(formatPath(parts)), parts);
    }
});

test('v1 active and inactive swipes upgrade once without executing and v2 quoted numbers survive reload', () => {
    const entry = ops => ({ kind: 'call', source: 'text', roots: ['数据'], rules: [], blocks: [], ops });
    const record = ops => ({ v: 1, entries: [entry(ops)] });
    ctx().chat[0].extra = { [key]: record([{ op: 'set', path: '数据', value: { a: [1], b: { '0': 2, '00': 3 }, 'Lv.3': 4 }, source: 'text' }]) };
    const first = record([{ op: 'set', path: '数据.a["00"]', value: 5, source: 'text' }]);
    const second = record([{ op: 'set', path: '数据.b["00"]', value: 6, source: 'text' }]);
    Object.assign(ctx().chat[1], { extra: { [key]: first }, swipes: ['one', 'two'], swipe_info: [{ extra: { [key]: first } }, { extra: { [key]: second } }] });
    ctx().chatMetadata.variables.数据 = JSON.stringify({ a: [5], b: { '0': 2, '00': 3 }, 'Lv.3': 4 });
    const before = structuredClone(ctx().chatMetadata.variables);
    h.executor.openStateChat();
    assert.deepEqual(ctx().chatMetadata.variables, before);
    assert.equal(ctx().chat[1].extra[key].v, 2);
    assert.deepEqual(ctx().chat[1].swipe_info[1].extra[key].entries[0].ops[0].path, ['数据', 'b', 0]);
    h.executor.rebuildStateV2(); assert.deepEqual(ctx().chatMetadata.variables, before);
    const message = ctx().chat[1]; message.swipe_id = 1; message.mes = 'two'; message.extra = structuredClone(message.swipe_info[1].extra);
    h.executor.handleStateSwipe(1); assert.deepEqual(read('数据').b, { '0': 6, '00': 3 });
    assert.equal(set('数据.b["00"]', 7).status, 'success');
    const saved = JSON.parse(JSON.stringify({ chat: ctx().chat, chatMetadata: ctx().chatMetadata }));
    h.executor.cleanupStateService(); Object.assign(ctx(), saved); h.executor.openStateChat(); h.executor.rebuildStateV2();
    assert.deepEqual(read('数据').b, { '0': 6, '00': 7 });
    ctx().chat.pop(); h.executor.rebuildStateV2(); assert.deepEqual(read('数据').b, { '0': 2, '00': 3 });
});

test('operation diagnostics identify the actual field, path and valid choices', () => {
    assert.throws(() => parseJsonInput({ ops: [{ op: 'replace', path: '角色.好感', value: 5 }] }), error => {
        assert.equal(error.index, 0); assert.equal(error.details.path, '角色.好感');
        assert.equal(error.details.actual, 'replace');
        assert.deepEqual(error.details.allowed, ['set', 'inc', 'push', 'remove', 'del']);
        return true;
    });
});

test('the skill initializer and worldbook example execute without persisting annotations', () => {
    const text = readFileSync(new URL('../state2/skill/references/xiaobaix-game-state.md', import.meta.url), 'utf8');
    const initial = text.match(/```text\r?\n(<state>[\s\S]*?<\/state>)\r?\n```/)[1];
    assert.deepEqual(api.applyText(initial, { floor: 0 }).errors, []);
    assert.equal(read('西厢').营救.计划已定, false);
    assert.equal(set('西厢.人物.红娘', { 在场: true, 好感: 50, 心思: '' }).status, 'success');
    const examples = [...text.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(match => JSON.parse(match[1]));
    const example = examples.find(value => value.state?.ops);
    const result = api.beginUpdate({ floor: 1, swipeId: 0 }).commit(example.state);
    assert.equal(result.errors.length, 0);
    assert.equal(read('西厢').人物.红娘.好感, 55);
    assert.equal(read('西厢').营救.计划已定, true);
    assert.ok(ctx().chat[1].extra[key].entries.flatMap(entry => entry.ops).every(op => !Object.hasOwn(op, 'reason') && !Object.hasOwn(op, 'old')));
});
