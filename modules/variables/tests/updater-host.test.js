import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Lost/duplicate settlement: regeneration's own deletion must retain its pending
// update; user deletion, chat switches and duplicate completion must not submit.
test('updater host preserves regeneration through its own deletion, but cancels real user changes', () => {
    const source = readFileSync('modules/variables/updater/host.js', 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'updater-host-test'");
    let ctx = { chat: [{ mes: 'old' }] }, updates = 0, disposed = 0;
    const handlers = new Map();
    const event_types = Object.fromEntries(['GENERATION_STARTED', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'CHAT_CHANGED',
        'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'SETTINGS_UPDATED'].map(key => [key, key]));
    const sandbox = { extension_settings: { LittleWhiteBox: { variablesCore: { enabled: true }, variablesMode: '2.0' } },
        getContext: () => ctx, isGenerating: () => false, createModuleEvents: () => ({ on: (key, fn) => handlers.set(key, fn), cleanup: () => handlers.clear() }), event_types,
        requestUpdate() {}, readSettings: () => ({ auto: true }), latestReply: () => ({ floor: ctx.chat.length - 1 }), hasBodyUpdate: () => false,
        createUpdateController: () => ({ update: async () => { updates++; }, cancel() {}, invalidate() {}, dispose() { disposed++; }, status: () => ({}) }),
        createUpdaterView: () => ({ refresh() {}, mountControls() {}, dispose() {} }),
        cancelAnimationFrame() {}, requestAnimationFrame: () => 1, observeBackgroundTask() {}, COPY: {},
    };
    runInNewContext(source + '\nglobalThis.host = { initVariableUpdater, notifyVariableReplyReady, cleanupVariableUpdater };', sandbox);
    sandbox.host.initVariableUpdater({});
    const emit = (name, ...args) => handlers.get(name)?.(...args);
    for (const [mode, order] of ['regenerate', 'normal', 'user-delete', 'chat-change'].flatMap(mode =>
        ['received-first', 'ready-first', 'rendered-first'].map(order => [mode, order]))) {
        const before = updates;
        ctx = { chat: [{ mes: 'old' }] };
        emit('GENERATION_STARTED', mode === 'regenerate' ? 'regenerate' : 'normal', {}, false);
        if (mode === 'regenerate' || mode === 'user-delete') { ctx.chat.pop(); emit('MESSAGE_DELETED', 0); }
        if (mode === 'chat-change') { ctx = { chat: [] }; emit('CHAT_CHANGED'); }
        ctx.chat.push({ mes: 'new' }); const index = ctx.chat.length - 1;
        // A4: core settlement may finish before this listener sees the message.
        // Either order must trigger once, not miss a paid automatic update.
        if (order === 'ready-first') sandbox.host.notifyVariableReplyReady(index);
        emit(order === 'rendered-first' ? 'CHARACTER_MESSAGE_RENDERED' : 'MESSAGE_RECEIVED', index);
        if (order !== 'ready-first') sandbox.host.notifyVariableReplyReady(index);
        assert.equal(updates - before, ['regenerate', 'normal'].includes(mode) ? 1 : 0, `${mode}: ${order}`);
        emit('MESSAGE_RECEIVED', index);
        emit('CHARACTER_MESSAGE_RENDERED', index);
        sandbox.host.notifyVariableReplyReady(index);
        assert.equal(updates - before, ['regenerate', 'normal'].includes(mode) ? 1 : 0, mode);
    }
    sandbox.host.cleanupVariableUpdater();
    assert.equal(disposed, 1); assert.equal(handlers.size, 0);
});

test('S1: pending swipe recovery follows native DOM restoration without settling or saving', async () => {
    const source = readFileSync('modules/variables/updater/host.js', 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'updater-host-test'");
    const handlers = new Map(), frames = new Map(), observers = new Set();
    let ctx, updates = 0, saves = 0, mounts = 0, sequence = 0;
    const floor = {}, chatNode = { querySelector: () => floor };
    const event_types = Object.fromEntries(['GENERATION_STARTED', 'MESSAGE_RECEIVED', 'MESSAGE_DELETED', 'CHAT_CHANGED',
        'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'SETTINGS_UPDATED'].map(key => [key, key]));
    const sandbox = { extension_settings: { LittleWhiteBox: { variablesCore: { enabled: true }, variablesMode: '2.0' } },
        getContext: () => ctx, isGenerating: () => false, createModuleEvents: () => ({ on: (key, fn) => handlers.set(key, fn), cleanup: () => handlers.clear() }), event_types,
        requestUpdate() {}, readSettings: () => ({ auto: true }), latestReply: () => ({ floor: ctx.chat.length - 1 }), hasBodyUpdate: () => false,
        createUpdateController: () => ({ update: async () => { updates++; }, cancel() {}, invalidate() {}, dispose() {}, status: () => ({}) }),
        createUpdaterView: () => ({ refresh() {}, mountControls() { mounts++; }, dispose() {} }),
        document: { getElementById: () => chatNode, querySelectorAll: () => [] },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.targets = []; observers.add(this); }
            observe(target, options) { this.targets.push({ target, options }); }
            disconnect() { observers.delete(this); }
        },
        cancelAnimationFrame: id => frames.delete(id), requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
        observeBackgroundTask() {}, COPY: {},
    };
    const resetChat = () => { ctx = { chat: [{ mes: 'older', swipe_id: 0, swipes: ['older'] }, { mes: 'last' }], saveChat: async () => { saves++; } }; };
    const emit = (name, ...args) => handlers.get(name)?.(...args);
    const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
    const pendingSwipe = () => { ctx.chat[0].swipe_id = 1; emit('MESSAGE_SWIPED', 0); emit('GENERATION_STARTED', 'swipe', {}, false); flush(); };
    resetChat();
    runInNewContext(source + '\nglobalThis.host = { initVariableUpdater, cleanupVariableUpdater };', sandbox);
    sandbox.host.initVariableUpdater({}); flush();
    for (const restore of ['replace-floor', 'rewrite-swipeid']) {
        pendingSwipe();
        assert.equal(observers.size, 1);
        const [observer] = observers;
        assert.equal(observer.targets[0].target, chatNode);
        assert.equal(observer.targets[0].options.childList, true);
        assert.equal(observer.targets[0].options.subtree, undefined);
        assert.equal(observer.targets[1].target, floor);
        assert.deepEqual([...observer.targets[1].options.attributeFilter], ['swipeid']);
        // No completion event: native rollback alone changes DOM after stop.
        const before = mounts;
        ctx.chat[0].swipe_id = 0;
        observer.callback([{ type: restore === 'replace-floor' ? 'childList' : 'attributes' }]);
        flush();
        assert.equal(mounts, before + 1);
        assert.equal(observers.size, 0);
    }
    for (const boundary of ['MESSAGE_RECEIVED', 'CHAT_CHANGED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPE_DELETED', 'dispose']) {
        resetChat(); pendingSwipe();
        assert.equal(observers.size, 1);
        if (boundary === 'dispose') sandbox.host.cleanupVariableUpdater();
        else { if (boundary === 'CHAT_CHANGED') resetChat(); await emit(boundary, 0); }
        assert.equal(observers.size, 0, boundary);
    }
    assert.equal(updates, 0); assert.equal(saves, 0); assert.equal(frames.size, 0);
});
