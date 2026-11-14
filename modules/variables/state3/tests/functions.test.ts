import type { Path } from '../types.js';
import { FunctionExecutionError, type FunctionOptions } from '../engine/functions-vm.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runFunctionInVm as run } from '../engine/functions.js';

// Contracts: guest code cannot read host credentials, silently omit dependencies, mutate
// candidate state, or hang settlement; invalid/aborted computations never yield a value.
const request = (source: string, extra: Partial<FunctionOptions> = {}) => ({ id: 'calculation', source, state: {}, ...extra });
const rejectsCode = (options: FunctionOptions, code: string, path?: Path) => assert.rejects(run(options), error => {
    assert.ok(error instanceof FunctionExecutionError);
    assert.equal(error.code, code);
    assert.equal(error.functionId, options.id);
    assert.equal(error.details.functionId, options.id);
    if (path) {assert.deepEqual(error.path, path);}
    return true;
});

test('functions compute from JSON input and declared current/starting reads without changing state', async () => {
    const state = { actor: { hp: 80, equipment: { charm: true } }, secret: 'host-only' };
    const beforeState = { actor: { hp: 100 } };
    const input: [number, { label: string }] = [20, { label: '伤势' }];
    const value = await run(request(`(input, {get, before}) => {
        const actor = get(['actor']); actor.hp = 0;
        input[1].label = 'changed';
        return {hp: get(['actor', 'hp']) - input[0], previous: before(['actor', 'hp']), missing: get(['actor', 'missing']) === undefined};
    }`, { state, beforeState, input, reads: [['actor']] }));
    assert.deepEqual(value, { hp: 60, previous: 100, missing: true });
    assert.equal(state.actor.hp, 80);
    assert.equal(beforeState.actor.hp, 100);
    assert.equal(input[1].label, '伤势');
});

test('functions cannot reach host, network, storage, clock or randomness', async () => {
    const result = await run(request(`() => [typeof window, typeof document, typeof self, typeof process,
        typeof require, typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof Worker,
        typeof localStorage, typeof indexedDB, typeof Date, typeof performance, typeof crypto,
        typeof setTimeout, typeof Math.random]`));
    assert.deepEqual(result, Array(16).fill('undefined'));
    assert.equal(await run(request(`() => ({}).constructor.constructor('return typeof process')()`)), 'undefined');
    await run(request(`() => { globalThis.injected = 42; Object.prototype.tainted = true; return true; }`));
    assert.deepEqual(await run(request(`() => [typeof injected, typeof ({}).tainted]`)), ['undefined', 'undefined']);
    assert.equal(Reflect.get(Object.prototype, 'tainted'), undefined);
});

test('all actual reads obey segment declarations, even when the guest catches the violation', async () => {
    const state = { actor: { hp: 80, secret: 3 }, 'actor.hp': 9, actor2: 7 };
    for (const path of [[], ['actor'], ['actor2'], ['actor.hp'], ['actor', 'secret']]) {
        await rejectsCode(request(`(_, {get}) => { try { get(${JSON.stringify(path)}); } catch {} return 1; }`, {
            state, reads: [['actor', 'hp']],
        }), 'function_undeclared_read', path);
    }
    await rejectsCode(request(`(_, {before}) => before(['actor'])`, { state, beforeState: state, reads: [] }), 'function_undeclared_read', ['actor']);
    await rejectsCode(request(`(_, {get}) => get('actor.hp')`, { state, reads: [['actor']] }), 'function_invalid_read');
    await rejectsCode(request(`(_, {before}) => before(['actor'])`, { state, reads: [['actor']] }), 'function_before_unavailable', ['actor']);
    assert.equal(await run(request(`(_, {get}) => get(['toString']) === undefined`, { state: {}, reads: [[]] })), true);
});

test('only synchronous JSON results may leave the VM', async () => {
    for (const source of ['() => undefined', '() => NaN', '() => Infinity', '() => ({x:undefined})',
        '() => [,,]', '() => {const x=[,];x.extra=1;return x;}', '() => new Map()', 'async () => 1', '() => { const x={};x.x=x;return x; }',
        '() => ({ get x() {return 2;} })']) {
        await rejectsCode(request(source), 'function_exception');
    }
    assert.deepEqual(await run(request(`() => JSON.parse('{"__proto__":{"safe":true}}')`)), JSON.parse('{"__proto__":{"safe":true}}'));
});

test('infinite loops, recursive overflow, and source evaluation are bounded and VM is reusable afterwards', async () => {
    await rejectsCode(request('() => { while (true) {} }'), 'function_work_limit');
    await rejectsCode(request('(() => { while (true) {} })()'), 'function_work_limit');
    await rejectsCode(request('() => { const f = () => f(); return f(); }'), 'function_exception');
    assert.equal(await run(request('() => 7')), 7);
});

// A failed guest must retain the exception and its source location; otherwise a
// broken card cannot be diagnosed. Error extraction must not execute guest getters.
test('guest syntax and runtime errors preserve structured diagnostics without running error getters', async () => {
    for (const [source, phase, name] of [
        ['() => 1;', 'source', 'SyntaxError'],
        ['() => { throw new TypeError("broken inventory"); }', 'execute', 'TypeError'],
    ]) {
        await assert.rejects(run(request(source)), error => {
            assert.ok(error instanceof FunctionExecutionError);
            assert.equal(error.code, 'function_exception');
            assert.equal(error.details.phase, phase);
            assert.equal(error.details.errorName, name);
            assert.ok(typeof error.details.message === 'string' && error.details.message.length > 0);
            assert.ok(typeof error.details.guestStack === 'string' && error.details.guestStack.includes('calculation.js'));
            return true;
        });
    }
    await assert.rejects(run(request('() => { throw { get message() { while (true) {} } }; }')), { code: 'function_exception' });
    assert.equal(await run(request('() => 7')), 7);
});

test('abort before initialization and between asynchronous initialization and execution produces no result', async () => {
    const early = new AbortController(); early.abort();
    await rejectsCode(request('() => { while (true) {} }', { signal: early.signal }), 'function_aborted');
    const pending = new AbortController();
    const promise = rejectsCode(request('() => 1', { signal: pending.signal }), 'function_aborted');
    pending.abort();
    await promise;
    assert.equal(await run(request('() => 2')), 2);
});
