import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { mergeNovelDrawProviderSettingsIntoStorageRoot } from '../draw-settings.js';
import { normalizeContinuityLimits, positiveInteger, stripEmptyCostumeText } from '../character-continuity.js';

// Acceptance contracts (cost: the memory range setting silently resets on reload; a hand edit stores the placeholder text or lands in the wrong chat):
// - continuityMaxFloors / continuityMaxEntries survive the provider-settings merge into the shared storage root.
// - Limits are normalized in one place: positive integers only, anything else falls back to the defaults (100 floors / 50 characters).
// - The memory-edit handler strips the "（空＝没穿）" placeholder from the costume before storing it.
// - If the chat changes while the edit is being prepared, nothing is written; the view of the current chat is posted instead.
// - Concurrent edits persist in input order even when the first image read is slower (cost: silently losing the latest user input).
// - Pending saves, removal/reset, and a failed operation cannot reorder or block later edits; leaving a chat cannot redirect queued edits (same data-loss cost).

test('the memory range settings survive the provider-settings merge', () => {
    const merged = mergeNovelDrawProviderSettingsIntoStorageRoot({ saveAsJpeg: true }, { mode: 'nai', continuityMaxFloors: 80, continuityMaxEntries: 20 });
    assert.equal(merged.continuityMaxFloors, 80);
    assert.equal(merged.continuityMaxEntries, 20);
    assert.equal(merged.mode, 'nai');
    assert.equal(merged.saveAsJpeg, true);
});

test('limits are normalized by one shared rule', () => {
    assert.deepEqual(normalizeContinuityLimits({}), { continuityMaxFloors: 100, continuityMaxEntries: 50 });
    assert.deepEqual(normalizeContinuityLimits({ continuityMaxFloors: '80', continuityMaxEntries: 3 }), { continuityMaxFloors: 80, continuityMaxEntries: 3 });
    assert.deepEqual(normalizeContinuityLimits({ continuityMaxFloors: 0, continuityMaxEntries: 1.5 }), { continuityMaxFloors: 100, continuityMaxEntries: 50 });
    assert.deepEqual(normalizeContinuityLimits(null), { continuityMaxFloors: 100, continuityMaxEntries: 50 });
    assert.equal(positiveInteger(-1, 7), 7);
    assert.equal(positiveInteger('12', 7), 12);
});

const imageRecords = [{ slotId: 'source-image', messageId: 0, timestamp: 0, continuityChars: [{ name: 'Alice', costume: 'grey coat', action: '' }] }];
const host = { ctx: null, messages: [], records: async () => imageRecords };
globalThis.__continuityHandlerTest = host;
const stubs = {
    'novel-prompts.js': 'exports.DEFAULT_PROMPT_CONFIG={topSystem:"fixture",topSystemPov:"fixture",sceneRules:"fixture"};exports.PROMPT_TEMPLATE_VERSION=1;exports.normalizeNovelPromptGuideOverrides=()=>({});',
    'extensions.js': 'exports.getContext=()=>globalThis.__continuityHandlerTest.ctx;',
    'script.js': 'exports.getRequestHeaders=()=>({});',
    'utils.js': 'exports.uuidv4=()=>"fixture-id";',
    'user.js': 'exports.getCurrentUserHandle=()=>"fixture-user";',
    'event-manager.js': 'exports.createModuleEvents=()=>({});exports.event_types={};',
    'server-storage.js': 'exports.NovelDrawStorage={getStrict:async()=>null,updateAndSave:async()=>true};',
    'gallery-cache.js': 'exports.getGalleryOverview=async()=>({stats:{count:0},summary:{}});',
    'scene-planner.js': 'module.exports={};',
    'worldbook-processor.js': 'module.exports={};',
    'draw-agent.js': 'module.exports={};',
    'draw-common.js': 'exports.DEFAULT_MESSAGE_FILTER_RULES=[];exports.getContinuityImageRecords=(...args)=>globalThis.__continuityHandlerTest.records(...args);',
    'after-ai-gate.js': 'module.exports={};',
    'iframe-messaging.js': 'exports.isTrustedMessage=()=>true;exports.postToIframe=(_,message)=>globalThis.__continuityHandlerTest.messages.push(message);',
};
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../../providers/novelai/novel-draw.js', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'continuity-io', setup(builder) {
        builder.onResolve({ filter: /\.js$/ }, ({ path }) => {
            const name = path.split('/').at(-1);
            return Object.hasOwn(stubs, name) ? { path: name, namespace: 'host' } : null;
        });
        builder.onLoad({ filter: /.*/, namespace: 'host' }, ({ path }) => ({ contents: stubs[path] }));
        builder.onLoad({ filter: /[\\/]novel-draw\.js$/ }, async ({ path }) => ({
            contents: `${await readFile(path, 'utf8')}\nexport { handleFrameMessage };`,
        }));
    } }],
});

const chatContext = (chatId) => {
    const ctx = { chatId, chat: [{ is_user: true, mes: 'hi' }], chatMetadata: {}, saves: 0 };
    ctx.saveMetadata = async () => { ctx.saves++; ctx.persisted = JSON.stringify(ctx.chatMetadata); };
    return ctx;
};
const lastMemory = () => host.messages.findLast(message => message.type === 'CONTINUITY_MEMORY');

test('the memory-edit handler strips the placeholder, and drops the edit when the chat changed meanwhile', async () => {
    const { document, window } = parseHTML('<html><body><iframe id="xiaobaix-novel-draw-iframe"></iframe></body></html>');
    Object.assign(globalThis, { document, window });
    // eslint-disable-next-line no-unsanitized/method -- Local source and offline I/O stubs only.
    const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text + '\n//# sourceURL=continuity-handler-fixture.mjs').toString('base64'));
    const send = data => api.handleFrameMessage({ data });
    const edit = costume => ({ type: 'CONTINUITY_MEMORY_EDIT', op: 'set', name: '韩枫', form: '', appear: 'old man', costume });

    // The placeholder text a model or user copied in is removed before the edit is stored.
    const chatA = chatContext('A');
    host.ctx = chatA;
    host.messages = [];
    await send(edit('（空＝没穿）, red coat，（空＝没穿）'));
    assert.equal(chatA.chatMetadata.LittleWhiteBox.continuityEdits[0].costume, 'red coat');
    assert.equal(lastMemory().entries.find(entry => entry.name === '韩枫').costume, 'red coat');
    await send(edit('（空＝没穿）'));
    assert.equal(chatA.chatMetadata.LittleWhiteBox.continuityEdits[0].costume, '', 'only the placeholder left means "not wearing"');
    assert.equal(chatA.chatMetadata.LittleWhiteBox.continuityEdits.length, 1);

    // The chat is switched while the image records are being read: the old chat must not receive the edit.
    const staleChat = chatContext('stale');
    const currentChat = chatContext('current');
    host.ctx = staleChat;
    host.records = async () => { host.ctx = currentChat; return []; };
    host.messages = [];
    await send(edit('red coat'));
    assert.equal(staleChat.chatMetadata.LittleWhiteBox, undefined, 'the chat that was left is untouched');
    assert.equal(currentChat.chatMetadata.LittleWhiteBox, undefined, 'the chat that is open did not get the edit either');
    assert.equal(staleChat.saves + currentChat.saves, 0);
    assert.deepEqual([lastMemory().hasChat, lastMemory().entries], [true, []], 'the view of the current chat is posted');
});

test('placeholder stripping keeps the real tags and tidies the commas it leaves behind', () => {
    assert.equal(stripEmptyCostumeText('（空＝没穿）'), '');
    assert.equal(stripEmptyCostumeText('（空＝没穿）, red coat'), 'red coat');
    assert.equal(stripEmptyCostumeText('red coat, （空＝没穿）'), 'red coat');
    assert.equal(stripEmptyCostumeText('a, （空＝没穿）, b'), 'a, b');
    assert.equal(stripEmptyCostumeText('red coat'), 'red coat');
    assert.equal(stripEmptyCostumeText(undefined), '');
});

test('a slow earlier edit cannot overwrite the latest input', async () => {
    const { document, window } = parseHTML('<html><body><iframe id="xiaobaix-novel-draw-iframe"></iframe></body></html>');
    Object.assign(globalThis, { document, window });
    // eslint-disable-next-line no-unsanitized/method -- Only the local bundled handler and fixed test stubs are imported.
    const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text + '\n//# sourceURL=continuity-handler-order.mjs').toString('base64'));
    host.ctx = chatContext('order');
    host.messages = [];
    let releaseFirst;
    const firstRead = new Promise(resolve => { releaseFirst = resolve; });
    let reads = 0;
    host.records = async () => { if (++reads === 1) await firstRead; return imageRecords; };
    const send = costume => api.handleFrameMessage({ data: { type: 'CONTINUITY_MEMORY_EDIT', op: 'set', name: 'Alice', costume } });
    const red = send('red coat');
    const blue = send('blue coat');
    await nextTurn();
    releaseFirst();
    await Promise.all([red, blue]);
    const persisted = JSON.parse(host.ctx.persisted);
    assert.equal(persisted.LittleWhiteBox.continuityEdits[0].costume, 'blue coat');
    assert.equal(lastMemory().entries[0].costume, 'blue coat');
});

async function orderFixture(label) {
    const { document, window } = parseHTML('<html><body><iframe id="xiaobaix-novel-draw-iframe"></iframe></body></html>');
    Object.assign(globalThis, { document, window });
    // eslint-disable-next-line no-unsanitized/method -- Only the local bundled handler and fixed test stubs are imported.
    const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text + `\n//# sourceURL=continuity-handler-${label}.mjs`).toString('base64'));
    const ctx = chatContext(label);
    host.ctx = ctx;
    host.messages = [];
    host.records = async () => imageRecords;
    const send = (op, costume = '', name = 'Alice') => api.handleFrameMessage({ data: { type: 'CONTINUITY_MEMORY_EDIT', op, name, costume } });
    return { ctx, send };
}

test('pending saves, edits to other characters, removal and reset retain their input order after reload', async () => {
    const { ctx, send } = await orderFixture('save-order');
    let releaseSave;
    const heldSave = new Promise(resolve => { releaseSave = resolve; });
    const saved = [];
    ctx.saveMetadata = async () => {
        const snapshot = JSON.stringify(ctx.chatMetadata);
        if (++ctx.saves === 1) await heldSave;
        ctx.persisted = snapshot;
        saved.push(JSON.parse(snapshot).LittleWhiteBox.continuityEdits ?? []);
    };
    const pending = [send('set', 'red coat'), send('set', 'green coat', 'Bobby'), send('remove'), send('reset'), send('set', 'blue coat')];
    await nextTurn();
    releaseSave();
    await Promise.all(pending);
    assert.deepEqual(saved.map(edits => edits.map(edit => [edit.name, edit.removed === true ? 'removed' : edit.costume])), [
        [['Alice', 'red coat']], [['Alice', 'red coat'], ['Bobby', 'green coat']],
        [['Bobby', 'green coat'], ['Alice', 'removed']], [], [['Alice', 'blue coat']],
    ]);
    ctx.chatMetadata = JSON.parse(ctx.persisted);
    await send('set', 'black coat', 'Bobby');
    assert.deepEqual(lastMemory().entries.map(entry => [entry.name, entry.costume]), [['Bobby', 'black coat'], ['Alice', 'blue coat']]);
});

test('a failed read is reported and does not block a later edit', async () => {
    const { ctx, send } = await orderFixture('failed-read');
    let reads = 0;
    host.records = async () => { if (++reads === 1) throw new Error('fixture read failure'); return imageRecords; };
    await Promise.all([send('set', 'red coat'), send('set', 'blue coat')]);
    assert.equal(ctx.saves, 1);
    assert.equal(JSON.parse(ctx.persisted).LittleWhiteBox.continuityEdits[0].costume, 'blue coat');
    assert.ok(host.messages.some(message => message.type === 'STATUS' && message.state === 'error'));
});

test('queued edits are discarded when the originating chat is left', async () => {
    const { ctx, send } = await orderFixture('left-chat');
    let releaseRead;
    const heldRead = new Promise(resolve => { releaseRead = resolve; });
    let reads = 0;
    host.records = async () => { if (++reads === 1) await heldRead; return imageRecords; };
    const pending = [send('set', 'red coat'), send('reset'), send('set', 'blue coat')];
    await nextTurn();
    const current = chatContext('current');
    host.ctx = current;
    releaseRead();
    await Promise.all(pending);
    assert.equal(ctx.saves + current.saves, 0);
    assert.equal(ctx.chatMetadata.LittleWhiteBox, undefined);
    assert.equal(current.chatMetadata.LittleWhiteBox, undefined);
});
