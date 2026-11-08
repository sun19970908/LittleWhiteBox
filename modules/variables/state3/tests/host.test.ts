import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
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
    let controls = 0, updaterCalls = 0;
    const event_types = Object.fromEntries(['CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'SETTINGS_UPDATED',
        'CHARACTER_MESSAGE_RENDERED', 'GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED', 'CHAT_CREATED'].map(key => [key, key]));
    const env = {
        createModuleEvents: () => ({ on: (key: string, fn: (...args: unknown[]) => unknown) => handlers.set(key, fn), cleanup: () => handlers.clear() }), event_types,
        observeBackgroundTask(p: Promise<unknown>) { pending.add(p); p.then(() => pending.delete(p), () => pending.delete(p)); },
        isGenerating: () => false, waitForAfterAiReady: async () => true, createSettlementService,
        ...h.exports, getContext: () => h.ctx, compileDefinition, diagnostic, reject, receiptResult, CHAT_KEY, CARD_EXTENSION,
        exportRules() {}, prepareRuleImport() {}, importRules() {}, state3Selected: () => true, selectState3() {},
        readSettings: () => ({ mode: 'auto', source: 'main' }), saveSettings() {},
        createState3Macros: () => ({ clear() {}, set() {}, dispose() {} }),
        createState3Updater: () => ({ cancel() {}, status: () => ({ phase: 'ready', busy: false }), update() { updaterCalls++; } }),
        createState3Page: () => ({ mountControl() { controls = 1; }, targetChanged() {}, dispose() {} }),
        notifyError(error: Error) { throw error; }, openDraft() {}, saveDraft() {}, checkDraft() {}, saveCardDraft() {},
        AbortController, structuredClone, CustomEvent: class {},
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
});
test('K11/K14: cancelling an old-floor swipe preserves already recorded later-floor effects', async () => {
    const h = harness(), adapter = h.exports.createHostAdapter(), service = createSettlementService(adapter);
    accepted(await service.enable());
    accepted(await service.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    h.ctx.chat.push({ mes: 'later', extra: {}, swipe_id: 0, swipes: ['later'], swipe_info: [{ extra: {} }] });
    accepted(await service.apply([{ op: 'set', path: ['hero', 'health'], value: 30 }]));
    h.message.swipe_id = 1;
    let selection = adapter.selectionChange('swipe', 0);
    await service.restoreSelection(selection.previous, selection.next);
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 30);
    h.message.swipe_id = 0;
    selection = adapter.selectionChange('swipe', 0);
    await service.restoreSelection(selection.previous, selection.next);
    assert.equal((accepted(await service.inspect()).state as { hero: { health: number } }).hero.health, 30);
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
