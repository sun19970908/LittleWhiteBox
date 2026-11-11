import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { fixture, accepted } from './fixture.js';
import { equipmentExample } from '../definition/example.js';
import { compileDefinition } from '../definition/compile.js';
import { digest } from '../definition/digest.js';
import { modelSource } from '../definition/stages.js';
import { beforeReceipt, beforeOutcome } from '../runtime/before-result.js';
import { buildUpdateTask, beforeProsePrompt } from '../model/prompts.js';
import { correctionTask } from '../../updater/correction.js';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { runFunctionInVm, type FunctionOptions } from '../engine/functions-vm.js';
import { CHAT_KEY } from '../definition/format.js';
import type { createBeforeGeneration } from '../runtime/before-generation.js';
import type { createState3Updater } from '../model/updater.js';
import type { ChatMessage } from '../runtime/host.js';
import type { Result } from '../types.js';
import type { AgentChatInput } from '../../../agent-core/public-api.js';

const source = (file: string) => ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'before-test'");

async function harness() {
    const f = fixture(), bundle = equipmentExample(); bundle.definition.updates = ['before', 'after'];
    bundle.definition.actions.forEach(action => {action.stages = ['before'];});
    bundle.definition.access.filter(entry => entry.write.includes('direct')).forEach(entry => {entry.stages = ['after'];});
    accepted(await f.service.enable(bundle));
    let chat: ChatMessage[] = [{ mes: 'opening', name: 'Hero' }], generating = false, prompt = '', selected = true, composer = '';
    let interceptor: (...args: unknown[]) => Promise<void>;
    const handlers = new Map<string, Set<(...args: unknown[]) => unknown>>(), pending = new Set<Promise<unknown>>();
    const requests: AgentChatInput[] = [], prose: { state: unknown; prompt: string }[] = [], results: Result[] = [], captures: string[] = [];
    const event_types = Object.fromEntries(['GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'MESSAGE_SENT', 'GENERATION_STOPPED',
        'GENERATION_ENDED', 'CHAT_CHANGED', 'MESSAGE_EDITED', 'MESSAGE_DELETED'].map(key => [key, key]));
    const emit = async (key: string, ...args: unknown[]) => { for (const listener of [...handlers.get(key) || []]) {await listener(...args);} };
    const ctx = () => ({ chat, chatId: 'isolated', chatMetadata: { [CHAT_KEY]: {} } });
    const latestUserIndex = (messages: ChatMessage[], end = messages.length) => {
        for (let index = end - 1; index >= 0; index--) {if (messages[index].is_user) {return index;}} return -1;
    };
    let disposedSessions = 0;
    let answer: () => unknown | Promise<unknown> = () => ({ completion: 'complete', truncated: false, text: '',
        toolCalls: [{ name: 'write', arguments: JSON.stringify({ state: [{ action: 'unequip', params: {} }] }) }] });
    const env = {
        getContext: ctx, latestUserIndex, digest, modelSource, beforeReceipt, beforeOutcome, beforeProsePrompt,
        compileDefinition, buildUpdateTask, correctionTask, mergeAbortSignals, diagnostic, reject, CHAT_KEY,
        AbortController, setTimeout, structuredClone, Promise, isGenerating: () => generating, inGroup: () => false,
        document: { getElementById: () => ({ value: composer }) },
        state3Selected: () => selected, passageText: (text: string) => text, exposeVariableReads: () => () => {},
        readSettings: () => ({ auto: false, source: 'main' }), SUBMIT_TOOL: 'write',
        captureContext: async (_ctx: unknown, target: { message: ChatMessage }) => {
            assert.equal(generating, false); captures.push(target.message.mes!);
            return { messages: [{ role: target.message.is_user ? 'user' : 'assistant', content: target.message.mes }] };
        },
        window: { xiaobaixAgent: { openSession: async () => ({ chat: async (task: AgentChatInput) => {requests.push(task); return answer();}, dispose() {disposedSessions++;} }) } },
        Generate: (type: string) => generate(type),
        setExtensionPrompt: (_id: string, value: string) => {prompt = value;}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
        registerGenerateInterceptor: (_id: string, fn: typeof interceptor) => {interceptor = fn;}, unregisterGenerateInterceptor() {}, GENERATE_INTERCEPTOR_ORDER: { VARIABLES: 350 },
        event_types, createModuleEvents: () => {
            const owned: [string, (...args: unknown[]) => unknown][] = [];
            return { on(key: string, fn: (...args: unknown[]) => unknown) {
                if (!handlers.has(key)) {handlers.set(key, new Set());} handlers.get(key)!.add(fn); owned.push([key, fn]);
            }, cleanup() {owned.forEach(([key, fn]) => handlers.get(key)!.delete(fn));} };
        }, observeBackgroundTask(promise: Promise<unknown>) {pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise));},
    };
    const updaterFactory = runInNewContext(source('model/updater.ts') + '\ncreateState3Updater', env) as typeof createState3Updater;
    const adapter = { ...f.adapter, submissionBasis: (index: number) => digest({ ...f.saved(), text: chat[index]?.mes, index }) };
    const updater = updaterFactory({ service: f.service as never, adapter: adapter as never, available() {if (generating || !selected) {reject('commit-busy');}} });
    const factory = runInNewContext(source('runtime/before-generation.ts') + '\ncreateBeforeGeneration', env) as typeof createBeforeGeneration;
    const retain = async (promise: Promise<Result>) => {const result = await promise; results.push(result); return result;};
    const create = () => factory({ adapter: f.adapter as never, service: f.service as never, updater, retain, refresh() {}, report: promise => promise });
    let before = create();
    function append(message: ChatMessage) {chat.push(message); const saved = f.saved(); saved.records.push({ entries: [] }); f.load(saved);}
    async function generate(type = 'normal', text?: string, deferred = false, automatic_trigger = false) {
        composer = text || '';
        generating = true;
        await emit(event_types.GENERATION_STARTED, type, {}, false);
        await emit(event_types.GENERATION_AFTER_COMMANDS, type, { automatic_trigger }, false);
        if (text !== undefined) {append({ mes: text, is_user: true, name: 'Player' }); await emit(event_types.MESSAGE_SENT, chat.length - 1);}
        let aborted = false;
        const dispatch = { input: { deferred, rebuild: false } };
        await interceptor([], 2048, () => {aborted = true;}, type, dispatch);
        generating = false;
        if (!aborted && !deferred) {prose.push({ state: f.saved().state, prompt }); await emit(event_types.GENERATION_ENDED);}
        return dispatch;
    }
    return { f, updater, generate, append, requests, prose, captures, results, emit, event_types, disposedSessions: () => disposedSessions,
        before: () => before, chat: () => chat, answer: (next: typeof answer) => {answer = next;},
        async drain() {while (pending.size) {await Promise.all([...pending]);}},
        reopen() {before.dispose(); f.load(f.saved()); chat = structuredClone(chat); before = create();},
        dispose() {selected = false; before.dispose();},
    };
}

function localFailures(count: number) {
    let remaining = count, created = 0, terminated = 0;
    class Worker {
        onmessage?: (event: { data: unknown }) => void;
        stopped = false;
        constructor() { created++; queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })); }
        terminate() { this.stopped = true; terminated++; }
        postMessage(request: FunctionOptions) {
            if (remaining-- > 0) {
                queueMicrotask(() => this.onmessage?.({ data: { error: { code: 'function_worker_error', functionId: request.id } } }));
                return;
            }
            void runFunctionInVm(request).then(value => {
                if (!this.stopped) {this.onmessage?.({ data: { value } });}
            }).catch(error => { if (!this.stopped) {this.onmessage?.({ data: { error: diagnostic(error) } });} });
        }
    }
    return { Worker: Worker as unknown as typeof globalThis.Worker, counts: () => ({ created, terminated }) };
}
function useFunction(h: Awaited<ReturnType<typeof harness>>) {
    const bundle = h.f.saved().card;
    bundle.definition.functions = { maximum: { reads: [['hero', 'amulet']], description: 'Equipment changes the health maximum.' } };
    bundle.functions = { maximum: '(_, {get}) => get(["hero", "amulet"]) ? 100 : 60' };
    bundle.definition.rules[0].value = { call: 'maximum', args: [] };
    h.f.setCard(bundle);
}

// E3: a paid submission survives local faults, not a session or chat snapshot;
// retry commits once and releases resources (duplicate API charge / partial state).
test('E3: automatic and repeated manual local retries use one model request and commit once', async t => {
    const previousWorker = globalThis.Worker; t.after(() => {globalThis.Worker = previousWorker;});
    for (const failures of [1, 6]) {
        const h = await harness(); t.after(() => h.dispose()); useFunction(h);
        const gate = localFailures(failures); globalThis.Worker = gate.Worker;
        const initial = h.f.saved(), notices = h.f.counts().notices;
        await h.generate('normal', 'Take off the amulet.'); await h.drain();
        assert.equal(h.requests.length, 1); assert.equal(h.disposedSessions(), 1);
        if (failures > 1) {
            for (let retry = 0; retry < 3; retry++) {
                assert.equal(h.updater.status().retryIndex, 1);
                assert.deepEqual(h.f.saved().state, initial.state);
                assert.equal(h.f.saved().records[1].entries.length, 0);
                assert.equal(h.f.counts().notices, notices);
                assert.equal(gate.counts().created, gate.counts().terminated);
                await h.before().run(1);
            }
        }
        assert.equal(h.requests.length, 1); assert.equal(h.disposedSessions(), 1);
        assert.equal(h.updater.status().retryIndex, undefined);
        assert.equal(h.f.saved().records[1].entries.length, 1);
        assert.equal(h.f.counts().notices, notices + 1);
        assert.equal((h.f.saved().state as {hero: {health: number}}).hero.health, 60);
        assert.equal(gate.counts().created, gate.counts().terminated);
    }
});

// E5: host regeneration resumes an unchanged paid submission; reload loses only
// that temporary input, never the player's ability to settle (duplicate API charge / dead end).
test('E5: regenerate reuses pending input; reload and changed input require a fresh request', async t => {
    const previousWorker = globalThis.Worker; t.after(() => {globalThis.Worker = previousWorker;});
    for (const change of ['none', 'reload', 'edit', 'new-message']) {
        const h = await harness(); t.after(() => h.dispose()); useFunction(h);
        const gate = localFailures(2); globalThis.Worker = gate.Worker;
        await h.generate('normal', 'Take off the amulet.'); await h.drain();
        assert.equal(h.requests.length, 1); assert.equal(h.prose.length, 0);
        assert.equal(h.updater.status().retryIndex, 1);
        if (change === 'reload') {h.reopen();}
        if (change === 'edit') {h.chat()[1].mes = 'Remove it now.'; await h.emit(h.event_types.MESSAGE_EDITED, 1);}
        await h.generate(change === 'new-message' ? 'normal' : 'regenerate', change === 'new-message' ? 'Remove it now.' : undefined);
        await h.drain();
        assert.equal(h.requests.length, change === 'none' ? 1 : 2);
        assert.equal(h.prose.length, 1);
        assert.equal(h.f.saved().records.at(-1)!.entries.length, 1);
        assert.equal(h.updater.status().retryIndex, undefined);
        assert.equal(gate.counts().created, gate.counts().terminated);
    }
});

// E4: a pending submission cannot outlive its basis or owner (stale writes / memory).
test('E4: pending local submissions are released on cancel, edit, chat, state, rules and disposal', async t => {
    const previousWorker = globalThis.Worker; t.after(() => {globalThis.Worker = previousWorker;});
    for (const change of ['cancel', 'edit', 'chat', 'state', 'rules', 'dispose']) {
        const h = await harness(); t.after(() => h.dispose()); useFunction(h);
        const gate = localFailures(2); globalThis.Worker = gate.Worker;
        await h.generate('normal', 'Take off the amulet.'); await h.drain();
        assert.equal(h.updater.status().retryIndex, 1);
        if (change === 'cancel') {h.before().cancel();}
        if (change === 'edit') {h.chat()[1].mes = 'Keep it.'; await h.emit(h.event_types.MESSAGE_EDITED, 1);}
        if (change === 'chat') {await h.emit(h.event_types.CHAT_CHANGED);}
        if (change === 'state') {const saved = h.f.saved(); (saved.state as {hero: {health: number}}).hero.health = 70; h.f.load(saved);}
        if (change === 'rules') {const bundle = h.f.saved().card; bundle.definition.name = 'Changed rules'; h.f.setCard(bundle);}
        if (change === 'dispose') {h.dispose();}
        assert.equal(h.updater.status().retryIndex, undefined);
        assert.equal(h.requests.length, 1); assert.equal(h.disposedSessions(), 1);
        assert.equal(gate.counts().created, gate.counts().terminated);
    }
});

// B3: one player action settles once across stop/retry/reload, and prose reads
// settled native state rather than a private candidate (double charge / wrong story).
test('B3: saved USER outcomes survive regeneration, reload, edits and explicit undo', async t => {
    const h = await harness(); t.after(() => h.dispose());
    await h.generate('normal', 'Take off the amulet.'); await h.drain();
    assert.equal(h.requests.length, 1); assert.equal(h.prose.length, 1);
    assert.equal((h.prose[0].state as { hero: { health: number } }).hero.health, 60);
    assert.ok(JSON.parse(h.prose[0].prompt.slice(h.prose[0].prompt.indexOf('\n') + 1)).changes.length);
    await h.generate('regenerate'); h.reopen(); await h.generate('regenerate');
    assert.equal(h.requests.length, 1);
    h.chat()[1].mes = 'Actually, keep it on.'; await h.emit(h.event_types.MESSAGE_EDITED, 1);
    await h.generate('regenerate'); assert.equal(h.requests.length, 1);
    await h.before().undo(1); await h.generate('regenerate');
    assert.equal(h.requests.length, 1);
    assert.equal((h.f.saved().state as { hero: { health: number } }).hero.health, 80);
    assert.equal(h.prose.at(-1)!.prompt, '');
    h.reopen(); await h.generate('regenerate');
    assert.equal(h.prose.at(-1)!.prompt, ''); assert.equal(h.requests.length, 1);
    await h.before().run(1); assert.equal(h.requests.length, 2);
    assert.equal(h.f.saved().records[1].entries.length, 1);
});

// B4: plan preview is not an action; final adopted text is captured and after
// receives the same durable before outcome (extra paid requests / duplicate effects).
test('B4: deferred input waits for adoption; after gets before facts with only its own tools', async t => {
    const h = await harness(); t.after(() => h.dispose());
    const dispatch = await h.generate('normal', 'A player action.', true);
    assert.equal(dispatch.input.rebuild, true); assert.equal(h.requests.length, 0);
    h.chat()[1].mes += '\nAn adopted plan.';
    await h.generate('regenerate'); await h.drain();
    assert.equal(h.captures[0], h.chat()[1].mes); assert.equal(h.requests.length, 1);
    h.append({ mes: 'The amulet is off.', name: 'Hero' });
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }));
    accepted(await h.updater.update({ stage: 'after', index: 2 }));
    const data = h.requests[1].messages.filter(message => message.role === 'tool').map(message => JSON.parse(String(message.content)));
    assert.equal(data[0].beforeUpdate.outcome, 'applied'); assert.equal(data[1].actions.length, 0);
    assert.equal(data[1].state.hero.health, 60);
});

// B5: technical failures stop prose and keep a visible retry/skip outcome;
// rejected gameplay does not turn into a transport error (unpaid/failed actions narrated as success).
test('B5: failed requests persist without prose, explicit skip resumes, valid rejection can be narrated', async t => {
    const h = await harness(); t.after(() => h.dispose());
    h.answer(() => {throw new Error('offline');});
    await h.generate('normal', 'Take off the amulet.'); await h.drain();
    assert.equal(h.prose.length, 0); assert.equal(h.f.saved().records[1].entries[0].beforeUpdate!.outcome, 'failed');
    h.reopen(); await h.generate('regenerate'); assert.equal(h.requests.length, 1);
    await h.before().skip(1); assert.equal(h.requests.length, 1); assert.equal(h.prose.length, 1);
    assert.equal(h.prose.at(-1)!.prompt, '');
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[{"action":"equip","params":{}}]}' }] }));
    await h.generate('normal', 'Equip another amulet.'); await h.drain();
    assert.equal(h.requests.length, 3); assert.equal(h.prose.length, 2);
    assert.equal(h.f.saved().records[2].entries[0].beforeUpdate!.outcome, 'rejected');
    const rejected = JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n'));
    assert.equal(rejected.outcome, 'rejected'); assert.deepEqual(rejected.changes, []);
    assert.equal(rejected.diagnostics[0].code, 'action-precondition');
    h.reopen(); await h.generate('regenerate');
    assert.deepEqual(JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n')), rejected);
    assert.equal(h.requests.length, 3);
});

// B10: empty/skip/undo outcomes stay out of prose while their receipts prevent
// paid reruns; actions and real rule changes remain visible (wrong story / cost).
test('B10: an empty before result clears prior prose context and survives reload without another request', async t => {
    const h = await harness(); t.after(() => h.dispose());
    await h.generate('normal', 'Take off the amulet.'); await h.drain();
    assert.ok(h.prose.at(-1)!.prompt);
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }));
    await h.generate('normal', 'Hello.'); await h.drain();
    const receipt = h.f.saved().records[2].entries[0];
    assert.equal(receipt.beforeUpdate!.outcome, 'applied');
    assert.deepEqual(beforeOutcome(receipt).changes, []); assert.deepEqual(receipt.actions, []);
    assert.equal(h.prose.at(-1)!.prompt, '');
    for (let attempt = 0; attempt < 2; attempt++) {
        h.reopen(); await h.generate('regenerate');
        assert.equal(h.prose.at(-1)!.prompt, ''); assert.equal(h.requests.length, 2);
        assert.equal(h.f.saved().records[2].entries[0].id, receipt.id);
    }
    await h.before().skip(2); h.reopen(); await h.generate('regenerate');
    assert.equal(h.prose.at(-1)!.prompt, ''); assert.equal(h.requests.length, 2);
});

test('B10: actions without net changes and empty submissions with rule changes both reach prose', async t => {
    for (const actionOnly of [true, false]) {
        const h = await harness(); t.after(() => h.dispose());
        const bundle = h.f.saved().card;
        if (actionOnly) {bundle.definition.actions.find(action => action.id === 'unequip')!.effects = [{ path: ['hero', 'amulet'], value: { literal: true } }];}
        else {
            bundle.definition.rules[0].value = { literal: 120 };
            h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }));
        }
        h.f.setCard(bundle);
        await h.generate('normal', 'A player message.'); await h.drain();
        const result = JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n'));
        assert.equal(result.outcome, 'applied');
        if (actionOnly) {assert.equal(result.actions[0].id, 'unequip'); assert.deepEqual(result.changes, []);}
        else {assert.deepEqual(result.actions, []); assert.ok(result.changes.length);}
        h.reopen(); await h.generate('regenerate');
        assert.deepEqual(JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n')), result);
        assert.equal(h.requests.length, 1);
    }
});

// B11: accepted before actions retain their executed parameters in prose and
// after requests, including after reload and without net changes (lost facts / wrong story).
test('B11: no-change before actions keep converted parameters across reload and after handoff', async t => {
    const h = await harness(); t.after(() => h.dispose());
    const bundle = h.f.saved().card;
    bundle.definition.access.find(entry => entry.path.at(-1) === 'health')!.write.push('heal');
    bundle.definition.actions.push({ id: 'heal', title: '治疗', stages: ['before'], description: 'Heal by twice the submitted amount.',
        parameters: { type: 'object', additionalProperties: false, required: ['amount'], properties: { amount: { type: 'number' } } },
        conversions: [{ path: ['amount'], value: { op: 'multiply', args: [{ param: ['amount'] }, { literal: 2 }] } }],
        requires: { literal: true }, effects: [{ path: ['hero', 'health'], value: { op: 'add', args: [{ get: ['hero', 'health'] }, { param: ['amount'] }] } }],
    });
    h.f.setCard(bundle);
    accepted(await h.f.service.apply([{ op: 'set', path: ['hero', 'health'], value: 100 }]));
    const initial = h.f.saved().state;
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: JSON.stringify({ state: [
        { action: 'heal', params: { amount: 5 } }, { action: 'heal', params: { amount: 10 } },
    ] }) }] }));
    await h.generate('normal', 'Use the small healing item, then the large one.'); await h.drain();
    const expected = [{ id: 'heal', params: { amount: 10 } }, { id: 'heal', params: { amount: 20 } }];
    const outcome = JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n'));
    assert.equal(outcome.outcome, 'applied'); assert.deepEqual(outcome.changes, []);
    assert.deepEqual(outcome.actions, expected); assert.deepEqual(h.f.saved().state, initial);
    assert.deepEqual(h.f.saved().records[1].entries[0].actions, expected);
    h.f.load(JSON.parse(JSON.stringify(h.f.saved()))); h.reopen();
    await h.generate('regenerate');
    assert.deepEqual(JSON.parse(h.prose.at(-1)!.prompt.split('\n').slice(1).join('\n')), outcome);
    assert.equal(h.requests.length, 1);
    h.append({ mes: 'Both healing items were used.', name: 'Hero' });
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }));
    accepted(await h.updater.update({ stage: 'after', index: 2 }));
    const manuscript = h.requests[1].messages.find(message => message.role === 'tool')!;
    assert.deepEqual(JSON.parse(String(manuscript.content)).beforeUpdate, outcome);
    assert.deepEqual(h.f.saved().state, initial);
});

// B6: quiet/continuation/automatic trigger and cancelled in-flight work must not
// create a paid before event or publish late results (cost / cross-context writes).
test('B6: auxiliary generation and cancellation do not publish; normal before hands off without a plugin save', async t => {
    const h = await harness(); t.after(() => h.dispose());
    h.append({ mes: 'Waiting player message.', name: 'Player', is_user: true });
    for (const type of ['quiet', 'continue', 'swipe', 'impersonate', 'normal']) {await h.generate(type);}
    await h.generate('normal', undefined, false, true); assert.equal(h.requests.length, 0);
    let release!: (value: unknown) => void, started!: () => void;
    const requestStarted = new Promise<void>(resolve => {started = resolve;});
    h.answer(() => {started(); return new Promise(resolve => {release = resolve;});});
    const proseCount = h.prose.length;
    await h.generate('regenerate'); await requestStarted; h.before().cancel();
    release({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }); await h.drain();
    assert.equal(h.f.saved().records[1].entries.length, 0); assert.equal(h.prose.length, proseCount);
    h.answer(() => ({ completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] }));
    const saves = h.f.counts().saves;
    h.f.failSave(); await h.generate('regenerate'); await h.drain();
    assert.equal(h.prose.length, proseCount + 1); assert.equal(accepted(h.results.at(-1)!).saved, undefined);
    assert.equal(h.f.counts().saves, saves);
});

// B8: a new player turn while the prior before request is pending cancels that
// request and runs the new one once (late writes / silently missed player action).
test('B8: a newer player message takes over after the cancelled updater releases', async t => {
    const h = await harness(); t.after(() => h.dispose());
    let release!: (value: unknown) => void, started!: () => void;
    const requestStarted = new Promise<void>(resolve => {started = resolve;});
    const response = { completion: 'complete', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] };
    h.answer(() => {started(); return new Promise(resolve => {release = resolve;});});
    await h.generate('normal', 'Old player action.'); await requestStarted;
    await h.generate('normal', 'New player action.');
    h.answer(() => response); release(response); await h.drain();
    assert.equal(h.requests.length, 2); assert.equal(h.prose.length, 1);
    assert.equal(h.f.saved().records[1].entries.length, 0);
    assert.equal(h.f.saved().records[2].entries.length, 1);
    assert.equal(h.captures.at(-1), 'New player action.');
    const anotherStarted = new Promise<void>(resolve => {started = resolve;});
    h.answer(() => {started(); return new Promise(resolve => {release = resolve;});});
    await h.generate('normal', 'Another old action.'); await anotherStarted;
    await h.generate('normal', 'A queued action.'); h.before().cancel();
    h.answer(() => response); release(response); await h.drain();
    assert.equal(h.requests.length, 3); assert.equal(h.prose.length, 1);
    assert.equal(h.f.saved().records.at(-1)!.entries.length, 0);
});
