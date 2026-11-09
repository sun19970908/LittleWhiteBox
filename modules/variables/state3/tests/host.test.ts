import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';
import { createSettlementService } from '../runtime/service.js';
import { createSaveQueue } from '../runtime/persistence.js';
import { clone, equal } from '../engine/data.js';
import { readVariables, writeVariables, variableRoots } from '../runtime/variables.js';
import { reject, diagnostic } from '../engine/diagnostics.js';
import { receiptResult } from '../runtime/history.js';
import { compileDefinition } from '../definition/compile.js';
import { decodeBundle } from '../definition/card-files.js';
import { equipmentExample } from '../definition/example.js';
import { CHAT_KEY, CARD_EXTENSION } from '../definition/format.js';
import type { State3Api } from '../runtime/api.js';
import type { Context, ChatMessage, createHostAdapter } from '../runtime/host.js';
import { accepted } from './fixture.js';
import { runFunctionInVm } from '../engine/functions-vm.js';
import type { Bundle } from '../types.js';

const source = (file: string) => ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*;\r?\n/gm, '').replace(/^export \{[^\n]*\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'host-test'");

function harness() {
    const message: ChatMessage = { mes: 'old', swipe_id: 0, swipes: ['old'], swipe_info: [{ extra: {} }], extra: {} };
    let saves = 0;
    const ctx = { chat: [message], chatMetadata: { variables: { neighbor: 'keep' } }, chatId: 'test', characterId: 0,
        characters: [{ name: 'test', chat: 'test', avatar: 'test.png', data: { extensions: { [CARD_EXTENSION]: JSON.stringify(equipmentExample()) } } }], saveChat: async () => { saves++; } } as unknown as Context;
    const env = { getContext: () => ctx, getRequestHeaders: () => ({}), CHAT_KEY, clone, equal, reject,
        createSaveQueue, readVariables, writeVariables, variableRoots, CARD_EXTENSION, decodeBundle,
        fetch: async () => ({ ok: true, json: async () => [{ chat_metadata: clone(ctx.chatMetadata) }] }),
    };
    const exports = runInNewContext(source('runtime/host.ts') + '\n({createHostAdapter,inGroup})', env) as {
        createHostAdapter(): ReturnType<typeof createHostAdapter>; inGroup(ctx: Context): boolean;
    };
    return { ctx, message, exports, saves: () => saves };
}

function runtimeHarness(bundle = equipmentExample(), initialMode = '3.0') {
    const h = harness(), pending = new Set<Promise<unknown>>(), handlers = new Map<string, (...args: unknown[]) => unknown>();
    h.ctx.characters[0].data!.extensions![CARD_EXTENSION] = JSON.stringify(bundle);
    const selector = { value: initialMode };
    const preferences = { LittleWhiteBox: { variablesMode: initialMode, state3Updater: { mode: 'manual', source: 'main' } } };
    const settings = runInNewContext(source('runtime/settings.ts') + '\n({readSettings,saveSettings,state3Selected,selectState3})', {
        extension_settings: preferences, reject, saveSettingsDebounced() {}, structuredClone,
        document: { getElementById: () => selector },
    });
    let finish!: (value: unknown) => void, requested!: () => void, disposed = false, lateControls = 0, lateMacros = 0;
    const started = new Promise<void>(resolve => { requested = resolve; });
    const response = new Promise(resolve => { finish = resolve; });
    const agentWindow = { xiaobaixAgent: { openSession: async () => ({ chat: async () => { requested(); return response; }, dispose() {} }) } };
    const { createState3Updater } = runInNewContext(source('model/updater.ts') + '\n({createState3Updater})', {
        getContext: () => h.ctx, exposeVariableReads: () => () => {}, captureContext: async () => ({}), passageText: (text: string) => text,
        compileDefinition, buildUpdateTask: () => ({}), SUBMIT_TOOL: 'write', ...settings, reject, diagnostic,
        AbortController, window: agentWindow, correctionTask() { throw new Error('unexpected correction'); },
    });
    const event_types = Object.fromEntries(['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'SETTINGS_UPDATED',
        'CHARACTER_MESSAGE_RENDERED', 'GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED', 'CHAT_CREATED'].map(key => [key, key]));
    const emitted: { state: unknown }[] = [];
    const env = {
        ...settings, createModuleEvents: () => ({ on: (key: string, fn: (...args: unknown[]) => unknown) => handlers.set(key, fn), cleanup: () => handlers.clear() }), event_types,
        observeBackgroundTask(p: Promise<unknown>) { pending.add(p); p.then(() => pending.delete(p), () => pending.delete(p)); },
        isGenerating: () => false, waitForAfterAiReady: async () => true, createSettlementService,
        ...h.exports, getContext: () => h.ctx, compileDefinition, diagnostic, reject, receiptResult, CHAT_KEY, CARD_EXTENSION,
        exportRules() {}, prepareRuleImport() {}, importRules() {}, onRulesSaved: () => () => {},
        createState3Macros: () => ({ clear() {}, set() { if (disposed) {lateMacros++;} }, dispose() {} }),
        createState3Updater,
        createState3Page: () => ({ mountControl() { if (disposed) {lateControls++;} }, targetChanged() {}, dispose() { disposed = true; } }),
        notifyError(error: Error) { throw error; }, openDraft() {}, saveDraft() {}, checkDraft() {}, saveCardDraft() {},
        AbortController, structuredClone, mergeAbortSignals, CustomEvent: class { constructor(public type: string, public options: { detail: { state: unknown } }) {} },
        MutationObserver: class { observe() {} disconnect() {} },
        document: { getElementById: () => ({ querySelector: () => ({}) }), querySelectorAll: () => [], dispatchEvent(event: { options: { detail: { state: unknown } } }) { emitted.push(event.options.detail); } },
        window: {} as { LWB_StateV3: State3Api },
    };
    const runtime = runInNewContext(source('index.ts') + '\ninitState3(); ({cleanupState3})', env);
    return { ...h, api: env.window.LWB_StateV3, handlers, preferences, selector, started, finish, emitted,
        cleanup: () => runtime.cleanupState3(), late: () => ({ controls: lateControls, macros: lateMacros }),
        async drain() { while (pending.size) {await Promise.all([...pending]);} },
    };
}

// R6/R7: delay worker delivery, not the rule or settlement implementation.
function workerGate() {
    let hold = false, announce!: () => void;
    const started = new Promise<void>(resolve => { announce = resolve; });
    const held: (() => void)[] = [];
    class ControlledWorker {
        onmessage?: (event: { data: { type?: string; value?: unknown; error?: ReturnType<typeof diagnostic> } }) => void;
        stopped = false;
        constructor() { queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })); }
        terminate() { this.stopped = true; }
        postMessage(request: Parameters<typeof runFunctionInVm>[0]) {
            const delaying = hold; hold = false;
            void runFunctionInVm(request).then(value => {
                const finish = () => { if (!this.stopped) {this.onmessage?.({ data: { value } });} };
                if (delaying) { held.push(finish); announce(); } else {finish();}
            }).catch(error => this.onmessage?.({ data: { error: diagnostic(error) } }));
        }
    }
    return { Worker: ControlledWorker as unknown as typeof Worker, hold: () => { hold = true; }, started, release: () => held.splice(0).forEach(finish => finish()) };
}

function doorBundle(): Bundle {
    const bundle = equipmentExample();
    bundle.definition = { ...bundle.definition, schema: {}, initial: { key: false, door: false },
        access: ['key', 'door'].map(key => ({ path: [key], write: ['direct'], description: key })),
        rules: [], actions: [], triggers: [], views: {},
        functions: { valid: { reads: [['key'], ['door']], description: '钥匙与门' } },
        constraints: [{ id: 'door-key', description: '开门必须持有钥匙', test: { call: 'valid', args: [] } }] };
    bundle.functions = { valid: '(_, {get}) => !get(["door"]) || get(["key"])' };
    return bundle;
}

// R6: an older recovery must never replace a later successful repair or announce stale state.
// Cost: false failure feedback and stale state sent to other interfaces.
test('R6: late recovery diagnostics cannot overwrite a successful repair', async t => {
    const gate = workerGate(), previousWorker = globalThis.Worker;
    globalThis.Worker = gate.Worker; t.after(() => { globalThis.Worker = previousWorker; });
    const h = runtimeHarness(doorBundle()); await h.drain(); accepted(await h.api.enable());
    accepted(await h.api.apply([{ op: 'set', path: ['key'], value: true }]));
    h.ctx.chat.push({ mes: 'door opens', swipe_id: 0, swipes: ['door opens'], swipe_info: [{ extra: {} }], extra: {} });
    accepted(await h.api.apply([{ op: 'set', path: ['door'], value: true }]));
    gate.hold(); h.message.swipe_id = 1;
    await h.handlers.get('MESSAGE_SWIPED')!(0); await gate.started;
    const repaired = accepted(await h.api.apply([{ op: 'set', path: ['key'], value: true }]));
    const events = h.emitted.length;
    gate.release(); await h.drain();
    assert.equal(h.api.lastResult(), repaired);
    assert.deepEqual(accepted(await h.api.inspect()).state, { key: true, door: true });
    assert.equal(h.emitted.length, events);
    h.cleanup();
});

// R7: disabling the feature stops uncommitted work and all late UI effects, not an already published save.
// Cost: state changes after shutdown, resurrected controls, or loss of a successful result.
test('R7: disposed model updates and staged calls cannot publish or resurrect controls', async t => {
    const h = runtimeHarness(); await h.drain(); accepted(await h.api.enable());
    const before = accepted(await h.api.inspect()).state;
    const updating = h.api.update(); await h.started; h.cleanup();
    h.finish({ completion: 'complete', truncated: false, text: '', toolCalls: [{ name: 'write', arguments: '{"state":[]}' }] });
    assert.equal((await updating).ok, false); await h.drain();
    assert.deepEqual(accepted(await h.api.inspect()).state, before);
    assert.deepEqual(h.late(), { controls: 0, macros: 0 });
    const previousWorker = globalThis.Worker; t.after(() => { globalThis.Worker = previousWorker; });
    for (const entry of ['apply', 'stage'] as const) {
        const gate = workerGate(); globalThis.Worker = gate.Worker;
        const active = runtimeHarness(doorBundle()); await active.drain(); accepted(await active.api.enable());
        gate.hold();
        const input = [{ op: 'set', path: ['key'], value: true }];
        const run = entry === 'apply' ? active.api.apply(input) : (await active.api.stage()).run(input, { preview: false, signal: new AbortController().signal });
        await gate.started; active.cleanup();
        assert.equal((await run).ok, false); gate.release(); await active.drain();
        assert.deepEqual(accepted(await active.api.inspect()).state, { key: false, door: false });
        assert.deepEqual(active.late(), { controls: 0, macros: 0 });
    }
});

test('R7: shutdown during persistence leaves the published result saved without late feedback', async () => {
    const h = runtimeHarness(); await h.drain(); accepted(await h.api.enable());
    let started!: () => void, release!: () => void;
    const saving = new Promise<void>(resolve => { started = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    h.ctx.saveChat = async () => { started(); await gate; };
    const updating = h.api.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]);
    await saving; h.cleanup(); release();
    const result = accepted(await updating); await h.drain();
    assert.equal(result.saved, true);
    assert.deepEqual(accepted(await h.api.inspect()).state, result.state);
    assert.deepEqual(h.late(), { controls: 0, macros: 0 });
});

// R8: updater mode is not a cancel command; selecting 3.0 must agree with the visible mode selector.
// Cost: a silently cancelled request or a UI that controls a different engine from the one displayed.
test('R8: enable synchronizes mode and off does not cancel an already requested update', async () => {
    const h = runtimeHarness(equipmentExample(), '2.0'); await h.drain(); accepted(await h.api.enable());
    assert.equal(h.selector.value, h.preferences.LittleWhiteBox.variablesMode);
    const updating = h.api.update(); await h.started;
    h.api.saveSettings({ mode: 'off', source: 'main' });
    h.finish({ completion: 'complete', truncated: false, text: '', toolCalls: [{ name: 'write', arguments: '{"state":[{"op":"set","path":["hero","health"],"value":20}]}' }] });
    const result = accepted(await updating); await h.drain();
    assert.equal(result.committed, true); assert.equal(h.api.settings().mode, 'off');
    assert.deepEqual(accepted(await h.api.inspect()).state, result.state);
    h.cleanup();
});

test('K11/K7: actual host publishes native values only and rejects stale panel edits', async () => {
    const h = harness(), adapter = h.exports.createHostAdapter(), service = createSettlementService(adapter);
    accepted(await service.enable());
    const native = h.ctx.chatMetadata.variables as Record<string, unknown>;
    assert.equal(native.neighbor, 'keep');
    assert.equal(Object.hasOwn(h.ctx.chatMetadata[CHAT_KEY]!, 'state'), false);
    const staged = await service.stage();
    native.hero = JSON.stringify({ ...readVariables(native).hero as object, health: 17 });
    await assert.rejects(staged.run([{ op: 'set', path: ['hero', 'health'], value: 12 }], { preview: false }), { code: 'stale-target' });
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 17);
});

test('K14/K13: native silent swipe recovery restores values and controls without replaying updates or notes', async () => {
    const h = harness(), handlers = new Map<string, (...args: unknown[]) => unknown>(), pending = new Set<Promise<unknown>>();
    const observers: { callback(): void; active: boolean }[] = [];
    let controls = 0, updaterCalls = 0, mode = 'auto';
    const event_types = Object.fromEntries(['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'SETTINGS_UPDATED',
        'CHARACTER_MESSAGE_RENDERED', 'GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED', 'CHAT_CREATED'].map(key => [key, key]));
    const env = {
        createModuleEvents: () => ({ on: (key: string, fn: (...args: unknown[]) => unknown) => handlers.set(key, fn), cleanup: () => handlers.clear() }), event_types,
        observeBackgroundTask(p: Promise<unknown>) { pending.add(p); p.then(() => pending.delete(p), () => pending.delete(p)); },
        isGenerating: () => false, waitForAfterAiReady: async () => true, createSettlementService,
        ...h.exports, getContext: () => h.ctx, compileDefinition, diagnostic, reject, receiptResult, CHAT_KEY, CARD_EXTENSION,
        exportRules() {}, prepareRuleImport() {}, importRules() {}, onRulesSaved: () => () => {}, state3Selected: () => true, selectState3() {},
        readSettings: () => ({ mode, source: 'main' }), saveSettings() {},
        createState3Macros: () => ({ clear() {}, set() {}, dispose() {} }),
        createState3Updater: () => ({ cancel() {}, status: () => ({ phase: 'ready', busy: false }), async update() {
            updaterCalls++; return { ok: true, state: {}, changes: [], provenance: [], actions: [], diagnostics: [] };
        } }),
        createState3Page: () => ({ mountControl() { controls = 1; }, targetChanged() {}, dispose() {} }),
        notifyError(error: Error) { throw error; }, openDraft() {}, saveDraft() {}, checkDraft() {}, saveCardDraft() {},
        AbortController, structuredClone, mergeAbortSignals, CustomEvent: class {},
        MutationObserver: class {
            record: { callback(): void; active: boolean };
            constructor(callback: () => void) { this.record = { callback, active: true }; observers.push(this.record); }
            observe() {} disconnect() { this.record.active = false; }
        },
        document: { getElementById: () => ({ querySelector: () => ({}) }), querySelectorAll: () => [], dispatchEvent() {} },
        window: {} as { LWB_StateV3: State3Api },
    };
    runInNewContext(source('index.ts') + '\ninitState3();', env);
    const drain = async () => { while (pending.size) {await Promise.all([...pending]);} };
    const api = env.window.LWB_StateV3;
    await drain(); accepted(await api.enable());
    accepted(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 20, reason: 'live-only' }]));
    const health = async () => (accepted(await api.inspect()).state as { hero: { health: number } }).hero.health;
    for (let attempt = 0; attempt < 2; attempt++) {
        h.message.swipe_id = 1;
        await handlers.get('MESSAGE_SWIPED')!(0); await drain();
        assert.equal(await health(), 80);
        assert.deepEqual(accepted(api.lastResult()!).changes, [{ path: ['hero', 'health'], before: 20, after: 80, removed: false }]);
        await handlers.get('GENERATION_STARTED')!('swipe', {}, false);
        await handlers.get('GENERATION_ENDED')!(); await drain();
        h.message.swipe_id = 0; h.message.extra = clone(h.message.swipe_info![0].extra); controls = 0;
        for (const observer of [...observers]) {if (observer.active) {observer.callback();}}
        await drain();
        assert.equal(await health(), 20); assert.equal(controls, 1); assert.equal(updaterCalls, 0);
        assert.equal(JSON.stringify(api.lastResult()).includes('live-only'), false);
        assert.equal(observers.filter(observer => observer.active).length, 1);
    }
    assert.equal(JSON.stringify(h.ctx.chatMetadata).includes('live-only'), false);
    // R4: prose is not an execution protocol; only automatic independent updates run after generation.
    // Cost: an invisible second writer or a blocked independent update.
    h.message.mes = '<state3>[{"op":"set","path":["hero","health"],"value":1}]</state3>';
    for (mode of ['manual', 'auto']) {
        await handlers.get('GENERATION_STARTED')!('normal', {}, false);
        await handlers.get('MESSAGE_RECEIVED')!(0);
        await handlers.get('GENERATION_ENDED')!(); await drain();
        assert.equal(await health(), 20);
        assert.equal(updaterCalls, mode === 'auto' ? 1 : 0);
    }
});
test('K11/K14: cancelling an old-floor swipe preserves already recorded later-floor effects', async () => {
    const h = harness(), adapter = h.exports.createHostAdapter(), service = createSettlementService(adapter);
    accepted(await service.enable());
    accepted(await service.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    h.ctx.chat.push({ mes: 'later', extra: {}, swipe_id: 0, swipes: ['later'], swipe_info: [{ extra: {} }] });
    accepted(await service.apply([{ op: 'set', path: ['hero', 'health'], value: 30 }]));
    h.message.swipe_id = 1;
    let selection = adapter.selectionChange('swipe', 0);
    assert.equal(selection.historical, true);
    await service.restoreSelection(selection.previous, selection.next);
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 30);
    h.message.swipe_id = 0;
    selection = adapter.selectionChange('swipe', 0);
    await service.restoreSelection(selection.previous, selection.next);
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 30);
});

// R3: a copied reply owns no settlement, including non-selected swipes; moving it and reopening cannot change that.
// Cost: deleting a copy silently undoes the original reply's saved effect.
test('R3: copies lose only inherited receipts, regardless of their position; originals survive save and reopen', async () => {
    const h = harness();
    let adapter = h.exports.createHostAdapter(), service = createSettlementService(adapter);
    accepted(await service.enable());
    accepted(await service.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    h.message.swipe_info!.push(clone(h.message.swipe_info![0])); h.message.swipes!.push('alternate');
    adapter.remember();
    h.message.extra!.neighbor = { keep: true };
    const original = clone(h.message), copy = clone(h.message);
    h.ctx.chat.unshift(copy); // A move must not transfer ownership to the first occurrence.
    assert.equal(adapter.rememberOrder(), true);
    assert.deepEqual(h.message, original);
    for (const holder of [copy, ...copy.swipe_info!]) {assert.equal(holder.extra?.[CHAT_KEY], undefined);}
    assert.deepEqual(copy.extra!.neighbor, { keep: true });
    assert.equal(h.saves(), 2, 'topology observation never settles or saves chat variables');
    h.ctx.chat.reverse(); adapter.rememberOrder();
    // SillyTavern reloads into the same array, with fresh messages and metadata.
    h.ctx.chat.splice(0, h.ctx.chat.length, ...clone(h.ctx.chat)); h.ctx.chatMetadata = clone(h.ctx.chatMetadata);
    adapter.remember();
    assert.deepEqual(h.ctx.chat[0].extra?.[CHAT_KEY], original.extra?.[CHAT_KEY]);
    adapter = h.exports.createHostAdapter(); service = createSettlementService(adapter);
    h.ctx.chat.pop();
    const change = adapter.selectionChange('delete');
    assert.equal(change.previous.length, 0);
    await service.restoreSelection(change.previous, change.next);
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 20);
    assert.ok(h.ctx.chat[0].extra?.[CHAT_KEY]);
});

// R4: removing the body entry point preserves applied results and lets a later independent update replace them.
// Cost: losing saved state or counting the same narrated event twice.
test('R4: chat-load normalization retains body effects and their replacement ownership', async () => {
    const h = harness();
    let service = createSettlementService(h.exports.createHostAdapter());
    accepted(await service.enable());
    const result = accepted(await service.apply([{ op: 'inc', path: ['hero', 'health'], delta: 5 }], { source: 'body' }));
    h.ctx.chat = clone(h.ctx.chat); h.ctx.chatMetadata = clone(h.ctx.chatMetadata);
    service = createSettlementService(h.exports.createHostAdapter());
    assert.deepEqual(accepted(await service.inspect()).state, result.state);
    accepted(await service.apply([{ op: 'inc', path: ['hero', 'health'], delta: 5 }], { source: 'model' }));
    assert.deepEqual(accepted(await service.inspect()).state, result.state);
    assert.equal((h.ctx.chat[0].extra![CHAT_KEY] as { entries: object[] }).entries.length, 1);
});

test('K15/K17: current card rules govern the next operation, owned roots do not expand, and typed native values survive', async () => {
    const h = harness();
    const bundle = equipmentExample();
    bundle.definition = { ...bundle.definition, schema: {}, initial: { own: {}, text: '123', flag: false },
        access: [{ path: ['own'], write: ['direct'], description: 'test' }, { path: ['text'], write: ['direct'], description: 'test' }],
        rules: [], actions: [], triggers: [], constraints: [], functions: {}, views: {} };
    const setCard = () => { h.ctx.characters[0].data!.extensions![CARD_EXTENSION] = JSON.stringify(bundle); };
    setCard();
    const service = createSettlementService(h.exports.createHostAdapter());
    accepted(await service.enable());
    const native = h.ctx.chatMetadata.variables as Record<string, unknown>;
    assert.deepEqual(accepted(await service.inspect()).state, bundle.definition.initial);
    assert.equal(Object.hasOwn(h.ctx.chatMetadata[CHAT_KEY]!, 'bundle'), false);
    native.gold = 75;
    const staged = await service.stage();
    bundle.definition.name = 'new';
    bundle.definition.access.push({ path: ['gold'], write: ['direct'], description: 'test' });
    bundle.definition.schema = { type: 'object', properties: { own: true, text: true, flag: true, gold: true } };
    bundle.definition.rules = [{ id: 'new-rule', kind: 'derive', path: ['own', 'calculated'], value: { literal: 3 }, description: 'test' }];
    setCard();
    await assert.rejects(staged.run([], { preview: false }), { code: 'stale-target' });
    accepted(await service.apply([{ op: 'set', path: ['own', 'gold'], value: 20 }]));
    assert.deepEqual(accepted(await service.inspect()).state, { own: { gold: 20, calculated: 3 }, text: '123', flag: false });
    assert.equal(native.gold, 75);
    await assert.rejects(service.apply([{ op: 'set', path: ['gold'], value: 4 }]), { code: 'unowned-root' });
    assert.equal(native.gold, 75);
    for (const value of ['123', 'true', 'null', '{"x":1}', '[1,2]', '"quoted"', '', 123, true, null, { x: 1 }, [1, 2]]) {
        accepted(await service.apply([{ op: 'set', path: ['text'], value }]));
        h.ctx.chatMetadata = JSON.parse(JSON.stringify(h.ctx.chatMetadata));
        assert.deepEqual((accepted(await service.inspect()).state as Record<string, unknown>).text, value);
    }
    accepted(await service.undo());
    assert.equal(native.gold, 75);
});

test('K16: a later child effect survives removal of its creator, toggles, replacement, undo and saved tail deletion', async () => {
    for (const scenario of [
        { value: { person: { affinity: 10, obsolete: 'old' } }, path: ['own', 'person', 'affinity'], expected: { person: { affinity: 11 } } },
        { value: { '0': { affinity: 10, obsolete: 'old' } }, path: ['own', '0', 'affinity'], expected: { '0': { affinity: 11 } } },
        { value: [{ obsolete: 'old' }, { affinity: 10, obsolete: 'old' }], path: ['own', '1', 'affinity'], expected: [null, { affinity: 11 }] },
    ]) {
        const h = harness(), bundle = equipmentExample();
        bundle.definition = { ...bundle.definition, schema: {}, initial: { own: {} },
            access: [{ path: ['own'], write: ['direct'], description: 'test' }], rules: [], actions: [], constraints: [], views: {} };
        h.ctx.characters[0].data!.extensions![CARD_EXTENSION] = JSON.stringify(bundle);
        let adapter = h.exports.createHostAdapter(), service = createSettlementService(adapter);
        accepted(await service.enable());
        accepted(await service.apply([{ op: 'set', path: ['own'], value: scenario.value }], { source: 'model' }));
        h.ctx.chat.push({ mes: 'later', extra: {}, swipe_id: 0, swipes: ['later'], swipe_info: [{ extra: {} }] });
        accepted(await service.apply([{ op: 'set', path: scenario.path, value: 11 }]));
        const original = accepted(await service.inspect()).state;
        for (let repeat = 0; repeat < 3; repeat++) {
            h.message.swipe_id = 1;
            let change = adapter.selectionChange('swipe', 0);
            await service.restoreSelection(change.previous, change.next);
            assert.deepEqual(accepted(await service.inspect()).state, { own: scenario.expected });
            h.message.swipe_id = 0;
            change = adapter.selectionChange('swipe', 0);
            await service.restoreSelection(change.previous, change.next);
            assert.deepEqual(accepted(await service.inspect()).state, original);
        }
        accepted(await service.apply([{ op: 'set', path: ['own'], value: {} }], { index: 0, source: 'model' }));
        assert.deepEqual(accepted(await service.inspect()).state, { own: scenario.expected });
        h.ctx.chat = JSON.parse(JSON.stringify(h.ctx.chat));
        h.ctx.chatMetadata = JSON.parse(JSON.stringify(h.ctx.chatMetadata));
        adapter = h.exports.createHostAdapter(); service = createSettlementService(adapter);
        h.ctx.chat.pop();
        const change = adapter.selectionChange('delete');
        await service.restoreSelection(change.previous, change.next);
        assert.deepEqual(accepted(await service.inspect()).state, { own: {} });
    }
});
