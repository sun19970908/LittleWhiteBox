import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { failure, runFunctionInVm, type FunctionOptions } from '../engine/functions-vm.js';
import { diagnostic } from '../engine/diagnostics.js';
import type { createFunctionRunner } from '../engine/functions.js';

// E1: a settlement owns at most one Worker; calls are isolated and all exit
// paths release Workers, timers and abort listeners (memory growth / leaked data).
// E2: scheduling gaps and late delivery must not invalidate valid rules;
// an actually unresponsive environment remains cancellable (lost API payment).
function harness(failureAt?: 'start' | 'send') {
    const workers: FakeWorker[] = [], timers = new Set<() => void>();
    let clock = 0, hidden = false;
    class FakeWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        onerror: ((event: Partial<ErrorEvent>) => void) | null = null;
        onmessageerror: (() => void) | null = null;
        ended = false;
        constructor() { if (failureAt === 'start') {throw new TypeError('worker construction failed');} workers.push(this); }
        postMessage() {if (failureAt === 'send') {throw new TypeError('worker clone failed');}}
        terminate() { this.ended = true; }
        message(data: unknown) { this.onmessage?.({ data }); }
    }
    const source = ts.transpileModule(readFileSync(new URL('../engine/functions.ts', import.meta.url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'https://test.local/runner.js'");
    const create = runInNewContext(source + '\ncreateFunctionRunner', {
        failure, runFunctionInVm, diagnostic, URL, Worker: FakeWorker,
        performance: { now: () => clock }, document: { get hidden() { return hidden; } },
        setInterval(fn: () => void) { timers.add(fn); return fn; }, clearInterval(fn: () => void) { timers.delete(fn); },
    }) as typeof createFunctionRunner;
    return { create, workers, timers, tick(gap = 1000, background = false) { clock += gap; hidden = background; [...timers].forEach(fn => fn()); } };
}
const options = (id: string, signal?: AbortSignal): FunctionOptions => ({ id, source: '() => 1', state: {}, signal });

test('E1: one runner reuses its Worker without keeping prior call handlers, and releases all exits', async () => {
    const h = harness(), runner = h.create();
    const signal = new AbortController().signal;
    let listeners = 0;
    const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = (...args: Parameters<typeof signal.addEventListener>) => { listeners++; add(...args); };
    signal.removeEventListener = (...args: Parameters<typeof signal.removeEventListener>) => { listeners--; remove(...args); };
    for (let index = 0; index < 20; index++) {
        const running = runner.run(options(String(index), signal));
        const worker = h.workers[0];
        if (!index) {worker.message({ type: 'ready' });}
        worker.message({ value: index });
        assert.equal(await running, index);
        assert.equal(h.workers.length, 1); assert.equal(h.timers.size, 0); assert.equal(listeners, 0);
    }
    const failed = assert.rejects(runner.run(options('current', signal)), { code: 'function_worker_error', functionId: 'current' });
    h.workers[0].onerror!({}); await failed;
    assert.equal(h.workers[0].ended, true); assert.equal(h.workers[0].onmessage, null);
    const next = new AbortController();
    const cancelled = assert.rejects(runner.run(options('cancelled', next.signal)), { code: 'function_aborted' });
    next.abort(); await cancelled;
    const disposed = assert.rejects(runner.run(options('disposed', signal)), { code: 'function_aborted' });
    runner.dispose(); await disposed;
    assert.ok(h.workers.every(worker => worker.ended && !worker.onmessage && !worker.onerror && !worker.onmessageerror));
    assert.equal(h.timers.size, 0); assert.equal(listeners, 0);
});

// D8：计算环境报错保留实际原因与位置并释放资源；代价：误改角色规则、重买模型请求。
test('D8: worker creation, dispatch and error events preserve diagnostics and release resources', async () => {
    for (const phase of ['start', 'send', 'startup-event', 'runtime-event'] as const) {
        const h = harness(phase === 'start' || phase === 'send' ? phase : undefined), runner = h.create();
        const error = new TypeError('worker module failed');
        const checked = assert.rejects(runner.run(options(phase)), caught => {
            const issue = diagnostic(caught);
            assert.equal(issue.code, phase === 'send' ? 'function_message_error' : phase === 'runtime-event' ? 'function_worker_error' : 'function_startup_failed');
            assert.equal((issue.cause as {errorName: string}).errorName, 'TypeError');
            if (phase.endsWith('event')) {
                assert.equal(issue.filename, 'worker-fixture.js'); assert.equal(issue.line, 17); assert.equal(issue.column, 5);
                assert.equal((issue.cause as {message: string}).message, error.message);
            }
            return true;
        });
        if (phase === 'send' || phase === 'runtime-event') {h.workers[0].message({type: 'ready'});}
        if (phase.endsWith('event')) {h.workers[0].onerror!({message:error.message,filename:'worker-fixture.js',lineno:17,colno:5,error});}
        await checked; runner.dispose();
        assert.equal(h.timers.size, 0); assert.ok(h.workers.every(worker => worker.ended));
    }
});

test('E2: late startup, suspension and result delivery are not guest work failures', async () => {
    const h = harness(), runner = h.create();
    const result = runner.run(options('slow'));
    for (let index = 0; index < 40; index++) {h.tick(1000, true);}
    h.tick(120000); h.workers[0].message({ type: 'ready' });
    h.tick(1400); h.tick(120000); h.workers[0].message({ value: 7 });
    assert.equal(await result, 7); assert.equal(h.timers.size, 0);
    const failed = assert.rejects(runner.run(options('unresponsive')), { code: 'function_worker_unresponsive', functionId: 'unresponsive' });
    for (let index = 0; index < 30; index++) {h.tick();}
    await failed; runner.dispose();
    assert.ok(h.workers.every(worker => worker.ended)); assert.equal(h.timers.size, 0);
});
