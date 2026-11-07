import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHarness, readStoredValue } from './helpers/state2-harness.js';

// Acceptance (duplicate/cross-chat writes and paid requests): one correction for rejected
// submissions, no publication before success, no model retry for network/save/cancel/stale.
// Real controller, transport and turn executor; host selection/persistence are isolated adapters.
let h, createController, requestUpdate, api, controller;
const ctx = () => h.env.state.ctx;
const key = 'LittleWhiteBox_state2';
const input = delta => ({ ops: [{ op: 'inc', path: '角色.金币', delta }] });
const response = value => ({ completion: 'complete', toolCalls: [{ id: 'write-1', name: 'write', arguments: JSON.stringify({ state: value }) }] });
const task = { systemPrompt: 'state task', messages: [{ role: 'user', content: 'original passage' }], tools: [], toolChoice: 'auto' };

test.before(async () => {
    h = await createHarness();
    for (const name of ['copy.js', 'preset.js', 'transport.js', 'correction.js']) {
        writeFileSync(path.join(h.tempDir, name), readFileSync(path.resolve('modules/variables/updater', name), 'utf8')
            .replace("'../shared/context-copy.js'", "'./context-copy.js'"));
    }
    writeFileSync(path.join(h.tempDir, 'context-copy.js'), readFileSync('modules/variables/shared/context-copy.ts', 'utf8'));
    const source = readFileSync('modules/variables/updater/controller.js', 'utf8')
        .replaceAll("'../state2/", "'./")
        .replace("import { latestReply, hasBodyUpdate } from './context.js';", `
const latestReply = ctx => ({ floor: ctx.chat.length - 1, swipeId: 0, message: ctx.chat.at(-1) });
const hasBodyUpdate = () => false;`)
        .replace("import { saveUpdate } from './persistence.js';", 'const saveUpdate = ctx => ctx.saveChat();');
    writeFileSync(path.join(h.tempDir, 'controller.js'), source);
    // eslint-disable-next-line no-unsanitized/method -- Isolated copies of real source, with host-only boundaries replaced above.
    ({ createUpdateController: createController } = await import(pathToFileURL(path.join(h.tempDir, 'controller.js')).href));
    // eslint-disable-next-line no-unsanitized/method -- Isolated copy of the real transport.
    ({ requestUpdate } = await import(pathToFileURL(path.join(h.tempDir, 'transport.js')).href));
});
test.beforeEach(() => {
    h.reset(); ctx().chat = [{ mes: 'init' }, { mes: 'passage' }];
    ctx().saveChat = function () { this.saveCount++; };
    api = h.executor.createStateApi();
    api.applyText('<state>角色: {"金币":100}</state>', { floor: 0 });
});
test.afterEach(() => { controller?.dispose(); delete globalThis.xiaobaixAgent; });
test.after(() => h.cleanup());

function setup(replies, hook = () => {}) {
    const sent = []; let disposed = 0;
    globalThis.xiaobaixAgent = { async openSession({ signal }) {
        signal.throwIfAborted();
        return { async chat(value) {
            sent.push(value); hook(sent.length);
            const next = replies[sent.length - 1];
            if (next instanceof Error) throw next;
            return next;
        }, dispose() { disposed++; } };
    } };
    controller = createController({ context: ctx, stateApi: api, assemble: async () => task, request: requestUpdate,
        settings: () => ({ source: 'main' }), assertAvailable() {}, changed() {} });
    return { sent, disposed: () => disposed };
}

test('malformed and rule-rejected writes get one correction with original reply and unchanged starting state', async () => {
    for (const first of [
        { completion: 'complete', toolCalls: [{ id: 'bad', name: 'write', arguments: '{broken' }] },
        response({ ops: [{ op: 'replace', path: '角色.金币', value: 5 }] }),
        response({ ops: [...input(-10).ops, { op: 'set', path: '陌生.金币', value: 50 }] }),
    ]) {
        const before = JSON.stringify(ctx().chat);
        const { sent, disposed } = setup([first, response(input(-5))], count => {
            if (count === 2) { assert.equal(JSON.stringify(ctx().chat), before); assert.equal(readStoredValue(ctx(), '角色').金币, 100); }
        });
        await controller.update();
        assert.equal(sent.length, 2); assert.equal(disposed(), 2);
        assert.equal(controller.status().phase, 'success');
        assert.equal(readStoredValue(ctx(), '角色').金币, 95);
        assert.deepEqual(sent[1].messages.slice(0, -1), task.messages);
        const feedback = JSON.parse(sent[1].messages.at(-1).content.split('\n\n').at(-1));
        assert.deepEqual(feedback.submission.toolCalls, first.toolCalls); assert.ok(feedback.errors.length);
        // A fresh replacement attempt must revoke the earlier successful update.
        api.beginUpdate({ floor: 1, swipeId: 0 }).commit({ ops: [] });
    }
});

test('second rejection keeps the real rollback and does not make a third request', async () => {
    api.beginUpdate({ floor: 1, swipeId: 0 }).commit(input(-5));
    const bad = response({ ops: [{ op: 'inc', path: '角色.金币', delta: '5' }] });
    const { sent } = setup([bad, bad]); await controller.update();
    assert.equal(sent.length, 2); assert.equal(controller.status().phase, 'failed');
    assert.equal(readStoredValue(ctx(), '角色').金币, 100);
    assert.deepEqual(ctx().chat[1].extra[key].entries[0].ops, []);
});

test('network, saving, cancellation and stale state never trigger an extra model submission', async () => {
    const network = setup([new Error('offline')]); await controller.update();
    assert.equal(network.sent.length, 1); assert.equal(readStoredValue(ctx(), '角色').金币, 100);
    const cancelled = setup([response(input(-5))], () => controller.cancel()); await controller.update();
    assert.equal(cancelled.sent.length, 1); assert.equal(controller.status().phase, 'cancelled');
    assert.equal(readStoredValue(ctx(), '角色').金币, 100);
    const stale = setup([response(input(-5))], () => { ctx().chatId = 'changed'; }); await controller.update();
    assert.equal(stale.sent.length, 1); assert.equal(readStoredValue(ctx(), '角色').金币, 100);
    ctx().chatId = 'test-chat';
    const failedSave = setup([response(input(-5))]); ctx().saveChat = () => { throw new Error('save failed'); };
    await controller.update(); assert.equal(failedSave.sent.length, 1); assert.equal(controller.status().saveFailed, true);
    assert.equal(readStoredValue(ctx(), '角色').金币, 95);
    ctx().saveChat = function () { this.saveCount++; };
    await controller.retrySave(); assert.equal(failedSave.sent.length, 1);
});

test('rollback save failure never calls the model; retry saves the revoked state without restoring its receipt', async () => {
    api.beginUpdate({ floor: 1, swipeId: 0 }).commit(input(-20));
    ctx().chat[1].extra.LittleWhiteBox_variableUpdate = { changes: [{}] };
    const { sent } = setup([response(input(-5))]);
    ctx().saveChat = () => { throw new Error('save failed'); };
    await controller.update();
    assert.equal(sent.length, 0);
    assert.equal(readStoredValue(ctx(), '角色').金币, 100);
    assert.equal(ctx().chat[1].extra.LittleWhiteBox_variableUpdate, undefined);
    assert.equal(controller.status().saveFailed, true);
    ctx().saveChat = function () { this.saveCount++; };
    await controller.retrySave();
    assert.equal(sent.length, 0);
    assert.equal(controller.status().phase, 'ready');
    assert.deepEqual(ctx().chat[1].extra[key].entries[0].ops, []);
});
