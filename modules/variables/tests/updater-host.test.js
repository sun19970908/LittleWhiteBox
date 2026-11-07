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
        initializeSettings() {}, requestUpdate() {}, readSettings: () => ({ mode: 'auto' }), latestReply: () => ({ floor: ctx.chat.length - 1 }), hasBodyUpdate: () => false,
        createUpdateController: () => ({ update: async () => { updates++; }, cancel() {}, dispose() { disposed++; }, status: () => ({}) }),
        createUpdaterView: () => ({ refresh() {}, mountControls() {}, dispose() {} }),
        cancelAnimationFrame() {}, requestAnimationFrame: () => 1, observeBackgroundTask() {}, COPY: {},
    };
    runInNewContext(source + '\nglobalThis.host = { initVariableUpdater, notifyVariableReplyReady, cleanupVariableUpdater };', sandbox);
    sandbox.host.initVariableUpdater({});
    const emit = (name, ...args) => handlers.get(name)?.(...args);
    for (const mode of ['regenerate', 'normal', 'user-delete', 'chat-change']) {
        const before = updates;
        ctx = { chat: [{ mes: 'old' }] };
        emit('GENERATION_STARTED', mode === 'regenerate' ? 'regenerate' : 'normal', {}, false);
        if (mode === 'regenerate' || mode === 'user-delete') { ctx.chat.pop(); emit('MESSAGE_DELETED', 0); }
        if (mode === 'chat-change') { ctx = { chat: [] }; emit('CHAT_CHANGED'); }
        ctx.chat.push({ mes: 'new' }); const index = ctx.chat.length - 1;
        emit('MESSAGE_RECEIVED', index);
        sandbox.host.notifyVariableReplyReady(index);
        sandbox.host.notifyVariableReplyReady(index);
        assert.equal(updates - before, ['regenerate', 'normal'].includes(mode) ? 1 : 0, mode);
    }
    sandbox.host.cleanupVariableUpdater();
    assert.equal(disposed, 1); assert.equal(handlers.size, 0);
});
