import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, readStoredValue } from './helpers/state2-harness.js';

// Acceptance contracts (invisible data corruption): replace only this floor's
// submission; preserve other owners; reject stale/partial results; survive reload.
let h, api;
const ctx = () => h.env.state.ctx;
const money = () => readStoredValue(ctx(), '角色').金钱;
const inc = delta => ({ ops: [{ op: 'inc', path: '角色.金钱', delta }] });
const target = () => ({ floor: ctx().chat.length - 1, swipeId: ctx().chat.at(-1).swipe_id });
const begin = () => api.beginTurn(target());
const continueTurn = () => api.beginContinuation(target());
const snapshot = () => structuredClone({ chat: ctx().chat, metadata: ctx().chatMetadata });
const record = () => ctx().chat.at(-1).extra?.[key];
const key = 'LittleWhiteBox_state2';
test.before(async () => { h = await createHarness(); });
test.beforeEach(() => {
    h.reset();
    ctx().chat = [{ mes: 'init', swipe_id: 0 }, { mes: 'prose', swipe_id: 0, swipe_info: [{ extra: {} }] }];
    h.executor.applyStateForMessage(0, '<state>角色: {"金钱":100,"背包":[]}</state>');
    api = h.executor.createStateApi();
});
test.after(() => h.cleanup());

// Independent updates must never remove a previous success merely by starting,
// failing or being abandoned. A late result must not cross a new chat/state.
test('staged replacement preserves live state until a valid current submission commits', () => {
    begin().commit(inc(-20));
    continueTurn().commit(inc(-5));
    const before = snapshot();
    const staged = api.stageTurn(target());
    assert.equal(JSON.parse(staged.snapshot.variables.角色).金钱, 100);
    assert.deepEqual(snapshot(), before);
    const rejected = staged.commit({ ops: [...inc(-7).ops, { op: 'inc', path: '未管理.值', delta: 1 }] });
    assert.equal(rejected.status, 'failed');
    assert.deepEqual(snapshot(), before);
    const competing = api.stageTurn(target());
    assert.equal(staged.commit(inc(-10)).status, 'success');
    assert.equal(money(), 90);
    assert.throws(() => competing.commit(inc(-15)), { code: 'stale_turn_target' });
    h.executor.rebuildStateV2();
    assert.equal(money(), 90);
});

test('same-floor continuations preserve the original submission and append one separate batch each', () => {
    begin().commit(inc(-20));
    const original = record();
    const before = snapshot();
    const continuation = continueTurn();
    assert.equal(money(), 80);
    assert.deepEqual(snapshot(), before);
    assert.equal(continuation.commit(inc(-5)).status, 'success');
    assert.equal(money(), 75);
    for (const [delta, expected] of [[-3, 72], [-2, 70]]) {
        assert.equal(continueTurn().commit(inc(delta)).status, 'success');
        assert.equal(money(), expected);
    }
    assert.deepEqual(record().entries.map(entry => [entry.scope, entry.ops[0].delta]), [
        ['turn', -20], ['turn', -5], ['turn', -3], ['turn', -2],
    ]);
    assert.equal(original.entries.length, 1);
    assert.deepEqual(ctx().chat[1].swipe_info[0].extra[key], record());
    h.executor.rebuildStateV2();
    assert.equal(money(), 70);
});

test('abandoned, invalid and rejected continuations never publish even the valid operations', () => {
    begin().commit(inc(-20));
    h.executor.cleanupStateService();
    const saved = ctx().saveCount;
    const before = snapshot();
    continueTurn(); // Cancelled request: dropping the handle is enough.
    const continuation = continueTurn();
    assert.throws(() => continuation.commit({ ops: [{ op: 'bad' }] }));
    const rejected = continuation.commit({ ops: [...inc(-5).ops, { op: 'inc', path: '未管理.值', delta: 1 }] });
    assert.equal(rejected.status, 'failed');
    assert.ok(rejected.errors.length);
    assert.deepEqual(rejected.changes, []);
    assert.deepEqual(rejected.corrections, []);
    assert.deepEqual(snapshot(), before);
    h.executor.cleanupStateService();
    assert.equal(ctx().saveCount, saved, 'no continuation mutation schedules a save');
    h.executor.rebuildStateV2();
    assert.equal(money(), 80);
});

test('successful and competing continuation handles cannot commit twice or overwrite newer state', () => {
    begin().commit(inc(-20));
    const first = continueTurn();
    const competing = continueTurn();
    first.commit(inc(-5));
    const before = snapshot();
    for (const handle of [first, competing]) {
        assert.throws(() => handle.assertCurrent(), { code: 'stale_turn_target' });
        assert.throws(() => handle.commit(inc(-5)), { code: 'stale_turn_target' });
        assert.deepEqual(snapshot(), before);
    }
    const noop = continueTurn();
    assert.equal(noop.commit({ ops: [] }).status, 'noop');
    assert.equal(record().entries.length, 3);
    assert.throws(() => noop.commit(inc(-5)), { code: 'stale_turn_target' });
    assert.equal(money(), 75);
});

test('full replacement removes all turn batches but preserves ordinary and body entries in order', () => {
    api.apply(inc(3));
    begin().commit({ ops: [{ op: 'set', path: '角色.金钱', value: 80 }] });
    h.executor.applyStateForMessage(1, '<state>角色.金钱: +4</state>');
    continueTurn().commit({ ops: [{ op: 'set', path: '角色.金钱', value: 20 }] });
    api.apply(inc(7));
    continueTurn().commit(inc(-2));
    assert.equal(money(), 25);
    const retained = record().entries.filter(entry => entry.scope !== 'turn');
    const turn = begin();
    assert.equal(money(), 114);
    assert.equal(record().entries.filter(entry => entry.scope === 'turn').length, 1);
    assert.deepEqual(record().entries.filter(entry => entry.scope !== 'turn'), retained);
    assert.equal(turn.commit({ ops: [{ op: 'set', path: '角色.金钱', value: 60 }] }).status, 'success');
    assert.equal(money(), 71, 'replacement runs before later body and ordinary entries');
    assert.deepEqual(record().entries.map(entry => entry.scope || entry.kind), ['call', 'turn', 'text', 'call']);
    h.executor.rebuildStateV2();
    assert.equal(money(), 71);
});

test('an empty initial submission still owns later continuation batches during replacement', () => {
    begin().commit({ ops: [] });
    continueTurn().commit(inc(-5));
    continueTurn().commit({ ops: [] });
    const turn = begin();
    assert.equal(money(), 100);
    assert.equal(record().entries.length, 1);
    turn.commit(inc(-10));
    h.executor.rebuildStateV2();
    assert.equal(money(), 90);
});

test('turn entry points reject nonterminal, wrong-swipe, user and system targets without mutations', () => {
    begin().commit(inc(-20));
    for (const start of [api.beginTurn, api.beginContinuation]) {
        for (const invalid of [{ floor: 0, swipeId: 0 }, { floor: 1, swipeId: 1 }]) {
            const before = snapshot();
            assert.throws(() => start(invalid), { code: 'invalid_turn_target' });
            assert.deepEqual(snapshot(), before);
        }
        for (const flag of ['is_user', 'is_system']) {
            ctx().chat[1][flag] = true;
            const before = snapshot();
            assert.throws(() => start(target()), { code: 'invalid_turn_target' });
            assert.deepEqual(snapshot(), before);
            delete ctx().chat[1][flag];
        }
    }
});

test('continuations retain range/step corrections and replay the original requested deltas', () => {
    h.executor.applyStateForMessage(0, '<state>$range=[0,100] $step=30 角色.金钱\n角色: {"金钱":100,"背包":[]}</state>');
    begin().commit(inc(-20));
    const stepped = continueTurn().commit(inc(-50));
    assert.equal(money(), 50);
    assert.equal(stepped.status, 'success');
    assert.equal(stepped.changes[0].delta, -30);
    assert.ok(stepped.corrections.length);
    assert.equal(record().entries[1].ops[0].delta, -50);
    continueTurn().commit(inc(-50));
    const ranged = continueTurn().commit(inc(-50));
    assert.equal(money(), 0);
    assert.equal(ranged.changes[0].delta, -20);
    assert.ok(ranged.corrections.length);
    h.executor.rebuildStateV2();
    assert.equal(money(), 0);
    const turn = begin();
    assert.equal(money(), 100);
    assert.equal(turn.commit(inc(-50)).changes[0].delta, -30);
    assert.equal(money(), 70);
});

test('missing submission on last floor never rolls back the preceding floor', () => {
    begin().commit(inc(-20));
    const previous = structuredClone(ctx().chat[1]);
    ctx().chat.push({ mes: 'new prose', swipe_id: 0 });
    const before = structuredClone(ctx().chatMetadata);
    const turn = begin();
    assert.equal(money(), 80);
    assert.deepEqual(ctx().chatMetadata, before);
    assert.deepEqual(ctx().chat[1], previous);
    turn.commit(inc(-5));
    assert.equal(money(), 75);
});

test('real rollback precedes request; repeated replacement retains ordinary calls and order', () => {
    api.apply(inc(3));
    begin().commit(inc(-20));
    api.apply(inc(7));
    for (let i = 0; i < 3; i++) {
        const turn = begin();
        assert.equal(money(), 110);
        assert.equal(turn.commit(inc(-20)).status, 'success');
        assert.equal(money(), 90);
        assert.equal(ctx().chat[1].extra[key].entries.length, 3);
        assert.throws(() => turn.commit(inc(-20)), { code: 'stale_turn_target' });
    }
    assert.deepEqual(ctx().chat[1].swipe_info[0].extra[key], ctx().chat[1].extra[key]);
});

test('invalid replacement publishes nothing; rolled-back slot survives reload', () => {
    begin().commit(inc(-20));
    const turn = begin();
    assert.throws(() => turn.commit({ ops: [{ op: 'bad' }] }));
    const failed = turn.commit({ ops: [...inc(-5).ops, { op: 'inc', path: '未管理.值', delta: 1 }] });
    assert.equal(failed.status, 'failed');
    assert.equal(money(), 100);
    h.executor.cleanupStateService();
    ctx().chat = structuredClone(ctx().chat);
    ctx().chatMetadata = structuredClone(ctx().chatMetadata);
    h.executor.rebuildStateV2();
    assert.equal(money(), 100);
    assert.equal(begin().commit({ ops: [] }).status, 'noop');
    assert.equal(money(), 100);
});

for (const [mode, start] of [['replacement', begin], ['continuation', continueTurn]]) {
    test(`${mode} rejects results after swipe, body, chat and variable changes`, () => {
        begin().commit(inc(-20));
        for (const mutate of [
            () => { ctx().chat[1].swipe_id++; },
            () => { ctx().chat[1].mes += ' edit'; },
            () => { ctx().chatMetadata = structuredClone(ctx().chatMetadata); },
            () => { ctx().chat = ctx().chat.slice(); },
            () => api.apply(inc(1)),
            () => { h.executor.cleanupStateService(); ctx().chatId += '-other'; },
        ]) {
            const turn = start();
            mutate();
            const before = snapshot();
            assert.throws(() => turn.commit(inc(-10)), { code: 'stale_turn_target' });
            assert.deepEqual(snapshot(), before);
        }
    });
}

test('only the selected swipe is reset; replay and deleting that floor restore every batch', () => {
    begin().commit(inc(-20));
    continueTurn().commit(inc(-5));
    h.executor.cleanupStateService();
    ctx().chat = structuredClone(ctx().chat);
    ctx().chatMetadata = structuredClone(ctx().chatMetadata);
    h.executor.openStateChat();
    h.executor.rebuildStateV2();
    assert.equal(money(), 75);
    const message = ctx().chat[1];
    message.swipes = ['old', 'new'];
    message.swipe_info.push({ extra: {} });
    message.swipe_id = 1; message.extra = {};
    h.executor.handleStateSwipe(1);
    assert.equal(money(), 100);
    begin().commit(inc(-5));
    continueTurn().commit(inc(-3));
    assert.equal(money(), 92);
    message.swipe_id = 0; message.extra = structuredClone(message.swipe_info[0].extra);
    h.executor.handleStateSwipe(1);
    assert.equal(money(), 75);
    begin().commit(inc(-10));
    assert.equal(money(), 90);
    assert.equal(record().entries.length, 1);
    assert.deepEqual(message.swipe_info[1].extra[key].entries.map(entry => entry.ops[0].delta), [-5, -3]);
    message.swipes.splice(0, 1);
    message.swipe_info.splice(0, 1);
    h.executor.handleStateSwipeDeleted({ messageId: 1, newSwipeId: 0 });
    assert.equal(money(), 92);
    assert.deepEqual(record().entries.map(entry => entry.ops[0].delta), [-5, -3]);
    ctx().chat.pop(); h.executor.rebuildStateV2();
    assert.equal(money(), 100);
});

for (const count of [1, 2]) {
    test(`replacement behind ${count} trailing users is idempotent and rolls back only the AI-owned batches`, () => {
        begin().commit(inc(-20));
        continueTurn().commit(inc(-5));
        h.executor.applyStateForMessage(1, '<state>角色.金钱: +4</state>');
        api.apply(inc(3));
        const ai = ctx().chat[1];
        const retained = structuredClone(ai.extra[key].entries.filter(entry => entry.scope !== 'turn'));
        const init = structuredClone(ctx().chat[0]);
        for (let index = 0; index < count; index++) {
            ctx().chat.push({
                mes: `user ${index}`, is_user: true, swipe_id: 0,
                swipes: [`user ${index}`, 'alternate user'],
                extra: { foreign: { value: index } }, swipe_info: [{ extra: { foreign: index } }, { extra: {} }],
            });
        }
        const users = ctx().chat.slice(2);
        const savedUsers = structuredClone(users);
        assert.equal(money(), 82);
        for (let iteration = 0; iteration < 3; iteration++) {
            const turn = api.beginTurn({ floor: 1, swipeId: 0 });
            assert.equal(money(), 107);
            assert.deepEqual(ai.extra[key].entries.filter(entry => entry.scope !== 'turn'), retained);
            assert.equal(ai.extra[key].entries.filter(entry => entry.scope === 'turn').length, 1);
            assert.equal(turn.commit(inc(-20)).status, 'success');
            assert.equal(money(), 87);
            assert.deepEqual(ctx().chat[0], init);
            assert.deepEqual(ctx().chat.slice(2), savedUsers);
            assert.ok(users.every((user, index) => ctx().chat[index + 2] === user));
            assert.deepEqual(ai.swipe_info[0].extra[key], ai.extra[key]);
            h.executor.rebuildStateV2();
            assert.equal(money(), 87);
        }
    });
}

test('tail user records replay after the changed AI without leaking future ownership into its submission', () => {
    begin().commit(inc(-20));
    continueTurn().commit(inc(-5));
    for (const text of [
        '<state>角色.金钱: +10\n未来: {"计数":1}</state>',
        '<state>角色.金钱: +7</state>',
    ]) {
        ctx().chat.push({ mes: text, is_user: true, swipe_id: 0, extra: { foreign: 'keep' }, swipe_info: [{ extra: {} }] });
        h.executor.applyStateForMessage(ctx().chat.length - 1, text);
        if (ctx().chat.length === 3) api.apply(inc(3));
    }
    assert.equal(money(), 95);
    const users = ctx().chat.slice(2);
    const savedUsers = structuredClone(users);
    for (let iteration = 0; iteration < 2; iteration++) {
        const turn = api.beginTurn({ floor: 1, swipeId: 0 });
        assert.equal(money(), 120, 'request baseline includes replayed tail-user effects');
        const before = snapshot();
        const rejected = turn.commit({ ops: [{ op: 'inc', path: '未来.计数', delta: 1 }] });
        assert.equal(rejected.status, 'failed', 'future user ownership is unavailable at the earlier AI floor');
        assert.deepEqual(snapshot(), before);
        const result = turn.commit({ ops: [{ op: 'set', path: '角色.金钱', value: 60 }] });
        assert.equal(result.status, 'success');
        assert.equal(result.changes[0].oldValue, 100, 'new operations execute at the actual AI position');
        assert.equal(money(), 80, 'tail deltas are replayed after the new AI assignment');
        assert.deepEqual(readStoredValue(ctx(), '未来'), { 计数: 1 });
        assert.deepEqual(ctx().chat.slice(2), savedUsers);
        assert.ok(users.every((user, index) => ctx().chat[index + 2] === user));
        h.executor.rebuildStateV2();
        assert.equal(money(), 80);
    }
});

test('replacement allows only the latest AI followed exclusively by explicit non-system users', () => {
    begin().commit(inc(-20));
    const ai = structuredClone(ctx().chat[1]);
    for (const suffix of [
        [{ mes: 'system', is_system: true }, { mes: 'user', is_user: true }],
        [{ mes: 'user', is_user: true }, { mes: 'new AI' }, { mes: 'user', is_user: true }],
        [{ mes: 'user/system', is_user: true, is_system: true }],
        [{ mes: 'not an explicit user', is_user: 1 }],
    ]) {
        ctx().chat.splice(2, Infinity, ...suffix);
        const before = snapshot();
        assert.throws(() => api.beginTurn({ floor: 1, swipeId: 0 }), { code: 'invalid_turn_target' });
        assert.deepEqual(snapshot(), before);
    }
    ctx().chat.splice(2, Infinity, { mes: 'user', is_user: true }, { mes: 'latest AI', swipe_id: 0 }, { mes: 'user', is_user: true });
    const before = snapshot();
    assert.throws(() => api.beginTurn({ floor: 1, swipeId: 0 }), { code: 'invalid_turn_target' });
    assert.throws(() => api.beginContinuation({ floor: 3, swipeId: 0 }), { code: 'invalid_turn_target' });
    assert.deepEqual(snapshot(), before);
    assert.equal(api.beginTurn({ floor: 3, swipeId: 0 }).commit(inc(-5)).status, 'success');
    assert.equal(money(), 75);
    assert.deepEqual(ctx().chat[1], ai);
});

for (const [mutation, mutate] of [
    ['append a user', () => ctx().chat.push({ mes: 'new user', is_user: true })],
    ['append an AI', () => ctx().chat.push({ mes: 'new AI' })],
    ['append a system', () => ctx().chat.push({ mes: 'new system', is_system: true })],
    ['delete a user', () => ctx().chat.pop()],
    ['replace a user', () => { ctx().chat[2] = structuredClone(ctx().chat[2]); }],
    ['reorder users', () => { [ctx().chat[2], ctx().chat[3]] = [ctx().chat[3], ctx().chat[2]]; }],
    ['edit the first user', () => { ctx().chat[2].mes += ' edit'; }],
    ['edit the last user', () => { ctx().chat[3].mes += ' edit'; }],
    ['switch a user swipe', () => { ctx().chat[2].swipe_id = 1; }],
    ['edit a saved user swipe', () => { ctx().chat[2].swipes[0] += ' edit'; }],
    ['edit user swipe data', () => { ctx().chat[2].swipe_info[0].extra.foreign = 'edit'; }],
    ['edit a user state record', () => { ctx().chat[2].extra[key].entries[0].ops[0].delta++; }],
    ['turn a user into an AI', () => { ctx().chat[2].is_user = false; }],
    ['turn a user into a system', () => { ctx().chat[2].is_system = true; }],
    ['replace the AI', () => { ctx().chat[1] = structuredClone(ctx().chat[1]); }],
    ['switch the AI swipe', () => { ctx().chat[1].swipe_id = 1; }],
    ['edit the AI body', () => { ctx().chat[1].mes += ' edit'; }],
    ['turn the AI into a user', () => { ctx().chat[1].is_user = true; }],
]) {
    test(`replacement behind users rejects stale results after ${mutation}`, () => {
        begin().commit(inc(-20));
        for (let index = 0; index < 2; index++) {
            ctx().chat.push({ mes: `user ${index}`, is_user: true, swipe_id: 0, swipes: [`user ${index}`], swipe_info: [{ extra: {} }] });
            api.apply(inc(1));
        }
        const turn = api.beginTurn({ floor: 1, swipeId: 0 });
        mutate();
        const before = snapshot();
        assert.throws(() => turn.assertCurrent(), { code: 'stale_turn_target' });
        assert.throws(() => turn.commit(inc(-10)), { code: 'stale_turn_target' });
        assert.deepEqual(snapshot(), before);
    });
}

test('replacement invalidates a cached terminal checkpoint without losing its prefix', () => {
    for (let floor = 2; floor < 100; floor++) {
        ctx().chat.push({ mes: 'prose', swipe_id: 0 });
        api.apply(inc(1));
        if (floor !== 49 && floor !== 99) continue;
        const before = money();
        begin().commit(inc(-20));
        continueTurn().commit(inc(-5));
        continueTurn().commit(inc(-3));
        assert.equal(money(), before - 28);
        const turn = begin();
        assert.equal(money(), before);
        turn.commit(inc(-5));
        h.executor.rebuildStateV2();
        assert.equal(money(), before - 5);
    }
});
