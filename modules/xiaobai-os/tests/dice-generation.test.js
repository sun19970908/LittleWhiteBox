import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { build } from 'esbuild';
import { prepareActionCheck } from '../apps/dice/application/prepare-action-check.ts';
import { captureDiceTarget } from '../apps/dice/host/message-records.ts';
import { buildActionCheckPrompt, projectActionCheckResults } from '../apps/dice/protocol/prompt.ts';
import { parseDiceRecords } from '../apps/dice/domain/check-records.ts';
import { generateCoc7Sheet } from '../apps/dice/domain/coc7-creation.ts';

// These regressions live at the native event/API boundary, which the session's continuation stub cannot cover.
// Run the actual adapter, readiness barrier, session and protocol; replace native I/O only.
const compiled = await build({
    stdin: { contents: `export { createDiceGenerationAdapter } from '../apps/dice/host/generation-adapter.ts';
        export { captureDiceChat, waitForDiceHost } from '../apps/dice/host/sillytavern-port.ts';
        export { host } from 'dice-generation-host';`,
        resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'dice-generation-host', setup(builder) {
        builder.onResolve({ filter: /^js-sha256$/ }, () => ({ path: import.meta.resolve('js-sha256'), external: true }));
        builder.onResolve({ filter: /(?:^dice-generation-host$|\/(?:script|group-chats|utils|extensions|event-manager|generate-interceptor|sillytavern-runtime-adapters|sillytavern-chat-save)\.js$|\/extensions\/regex\/engine\.js$)/ },
            () => ({ path: 'host', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
            const listeners = new Map();
            export let is_group_generating = false;
            export let isChatSaving = false;
            export let is_send_press = false;
            export const host = {
                source: null, get busy() { return is_send_press; }, set busy(value) { is_send_press = value; },
                get savingActive() { return isChatSaving; },
                draft: '', enabled: true, requests: [], prompts: new Map(), diceWrites: 0, ids: 0, nativeSaves: [],
                preflight: async () => {}, controller: null, stream: null, reply: normalReply, editing: false,
                generate,
                async saveNative() {
                    isChatSaving = true;
                    try { await Promise.resolve(); host.nativeSaves.push(JSON.parse(JSON.stringify(host.source.chat))); }
                    finally { isChatSaving = false; }
                },
                async emit(name, ...args) { for (const fn of [...(listeners.get(name) ?? [])]) await fn(...args); },
                listen(name, fn) {
                    if (!listeners.has(name)) listeners.set(name, new Set());
                    listeners.get(name).add(fn);
                    return () => listeners.get(name).delete(fn);
                },
                group(value) { is_group_generating = value; },
                saving(value) { isChatSaving = value; },
                lock() { setSendButtonState(true); deactivateSendButtons(); },
                unlock: activateSendButtons,
                stop: stopGeneration,
                async intercept(type) { let aborted = false; await host.interceptor([], 0, () => { aborted = true; }, type); return aborted; },
                reset(source) {
                    Object.assign(host, { source, busy: false, draft: '', enabled: true, requests: [], diceWrites: 0, ids: 0, nativeSaves: [],
                        preflight: async () => {}, controller: null, stream: null, reply: normalReply, editing: false,
                        stopVisible: false, dataGenerating: false, locks: 0 });
                    host.prompts.clear(); is_group_generating = false; isChatSaving = false; is_send_press = false;
                },
            };
            export const event_types = new Proxy({}, { get: (_, name) => name });
            export const eventSource = {
                makeFirst(name, fn) { listeners.set(name, new Set([fn, ...(listeners.get(name) ?? [])])); },
                removeListener(name, fn) { listeners.get(name)?.delete(fn); },
            };
            export function createModuleEvents() { const owned = []; return {
                on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); owned.push([name,fn]); },
                cleanup() { for (const [name,fn] of owned) listeners.get(name).delete(fn); },
            }; }
            export const registerGenerateInterceptor = (_, fn) => { host.interceptor = fn; };
            export const unregisterGenerateInterceptor = () => { host.interceptor = null; };
            export const GENERATE_INTERCEPTOR_ORDER = {};
            export const setSillyTavernPrompt = (key, value) => host.prompts.set(key, value);
            export const uuidv4 = () => 'generated-' + host.ids++;
            export const getContext = () => ({ ...host.source, name2: host.source.characterName, generate,
                streamingProcessor: host.stream,
                characters: { [host.source.characterId]: { avatar:host.source.avatar, name:host.source.characterName } } });
            export const extension_settings = { disabledExtensions: [] };
            export const SCRIPT_TYPES = { GLOBAL: 0 };
            export const getScriptsByType = () => [];
            export const saveScriptsByType = () => host.preflight();
            export const getRequestHeaders = () => ({});
            export const saveSillyTavernChat = async () => { host.diceWrites++; throw new Error('Unexpected Dice chat save'); };
            // Match ST 1.14's native boundary: live flags, without an isGenerating export.
            export const setSendButtonState = value => { is_send_press = value; };
            export const deactivateSendButtons = () => { host.stopVisible = true; host.dataGenerating = true; host.locks++; };
            function hideStopButton() {
                if (!host.stopVisible) return;
                host.stopVisible = false; void host.emit('GENERATION_ENDED');
            }
            export function activateSendButtons() {
                setSendButtonState(false); hideStopButton(); host.dataGenerating = false;
            }
            export const setCharacterId = value => { host.source.characterId = value; };
            export const setCharacterName = value => { host.source.characterName = value; };
            export const setExternalAbortController = value => { host.controller = value; };
            export function stopGeneration() { host.stream?.onStopStreaming?.(); host.controller?.abort(); hideStopButton(); void host.emit('GENERATION_STOPPED'); }

            // Frozen ST 1.18 boundary: nonzero depth skips composer consumption; outer Generate drops depth
            // when delegating to a group wrapper, while the wrapper forwards its own params to each member.
            async function generate(type, options = {}) {
                await host.emit('GENERATION_STARTED', type, options, false);
                if (!(host.controller && options.signal)) host.controller = new AbortController();
                await host.emit('GENERATION_AFTER_COMMANDS', type, options, false);
                if (host.source.groupId && !is_group_generating) {
                    return generateGroupWrapper(false, type, {signal:options.signal, force_chid:options.force_chid});
                }
                if (!options.depth && host.draft) {
                    host.source.chat.push({mes:host.draft,is_user:true,extra:{}}); host.draft = '';
                }
                host.lock();
                if (await host.intercept(type) || options.signal?.aborted) { activateSendButtons(); return; }
                const prompt = host.prompts.get('xiaobai_os_dice');
                await host.emit('GENERATE_AFTER_DATA', {}, false);
                host.requests.push({type, signal:host.controller.signal, busy:is_send_press || is_group_generating, prompt});
                try {
                    await host.reply(host.controller.signal);
                    if (!host.stream?.isStopped) await host.saveNative();
                }
                finally { activateSendButtons(); }
            }
            async function normalReply() {
                host.source.chat.at(-1).mes += '\\n\\nAfterward.';
                await host.emit('MESSAGE_RECEIVED', host.source.chat.length - 1, 'appendFinal');
                host.stream = null;
            }
            export async function generateGroupWrapper(_auto, type, options) {
                is_group_generating = true;
                try { return await generate(type, options); }
                finally { is_group_generating = false; await host.emit('GROUP_WRAPPER_FINISHED'); }
            }
        ` }));
    } }],
});
// eslint-disable-next-line no-unsanitized/method -- Compiled repository modules and fixed native I/O fixture only.
const { createDiceGenerationAdapter, captureDiceChat, waitForDiceHost, host } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

const call = 'Attempt.\n\n<xb_action_check>{"action":"Climb","stat":"Agility","difficulty":"hard"}</xb_action_check>';
const cocCall = '<xb_action_check>' + JSON.stringify({ action: 'Force the door', stat: 'body', difficulty: 'regular' }) + '</xb_action_check>';
const message = mes => ({ name: 'Mira', mes, extra: {} });
function setup(t, group = false, reveal = async () => {}) {
    t.mock.method(console, 'error', () => {});
    const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected Dice network request'); });
    t.after(() => {
        assert.equal(host.diceWrites, 0, 'checks and retries never issue an extra chat save');
        assert.equal(network.mock.calls.length, 0, 'checks and retries never read back or write chat over HTTP');
    });
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        querySelector: () => host.editing ? {} : null, getElementById: () => null,
    } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { toastr: { error: () => assert.fail('Dice must not add error toasts') } } });
    t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
    t.after(() => { if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document; });
    host.reset({ key: group ? 'group:g:chat' : 'character:mira.png:chat', chatId: 'chat', chat: [message('Old reply')],
        characterId: 0, characterName: 'Mira', avatar: 'mira.png', ...(group ? { groupId: 'g' } : {}) });
    host.frequency = 'standard';
    host.rule = 'd20';
    host.sheet = generateCoc7Sheet(() => 0.5);
    host.sheetReads = 0;
    host.busyViews = [];
    const adapter = createDiceGenerationAdapter(() => host.enabled, () => host.frequency, () => host.busyViews.push(adapter.isBusy()), reveal, () => host.rule, () => { host.sheetReads++; return host.sheet; });
    adapter.start();
    t.after(() => adapter.stop());
    return adapter;
}
async function begin(type = 'normal', options = {}) {
    await host.emit('GENERATION_STARTED', type, options, false);
    await host.emit('GENERATION_AFTER_COMMANDS', type, options, false);
}
async function received() { await host.emit('MESSAGE_RECEIVED', host.source.chat.length - 1, 'normal'); }
async function settled(adapter) {
    for (let count = 0; count < 50; count++) {
        await setImmediate();
        if (!adapter.view() || ['invalid','continue-error'].includes(adapter.view().phase.kind)) return;
    }
    assert.fail('Dice chain did not settle');
}

const upstreamMessage = JSON.parse(readFileSync(new URL('./fixtures/dice-message-a32c28d0.json', import.meta.url), 'utf8'));

test('continuation injection follows retained markers after edits, moves, deletions and reinsertion', async t => {
    setup(t);
    const target = structuredClone(upstreamMessage);
    host.source.chat = [target];
    const raw = structuredClone(target.extra.xiaobaiOsDice);
    const [wall, door] = parseDiceRecords(raw).checks;
    for (const frequency of ['standard', 'active']) {
        host.frequency = frequency;
        for (const [body, referenced] of [
            ['Rewritten approach. [dice:wall] Different transition. [dice:door]', [wall, door]],
            ['Door first. [dice:door] Wall afterward. [dice:wall]', [door, wall]],
            ['Only the wall remains. [dice:wall]', [wall]],
            ['All references removed.', []],
            ['Restored door. [dice:door]', [door]],
        ]) {
            target.mes = body;
            await begin('continue');
            assert.equal(await host.intercept('continue'), false);
            const prompt = host.prompts.get('xiaobai_os_dice');
            if (referenced.length) {
                assert.deepEqual(JSON.parse(prompt.split('\n').at(-1)), projectActionCheckResults(referenced));
            } else {
                assert.equal(prompt, buildActionCheckPrompt(body, [], frequency), 'deletion keeps the check instructions installed');
            }
            assert.deepEqual(target.extra.xiaobaiOsDice, raw, 'reading a migrated result never rewrites saved history');
        }
    }
});

test('same-roll recovery accepts an edited terminal marker even after removing a later saved check', async t => {
    const adapter = setup(t);
    const target = structuredClone(upstreamMessage);
    const raw = structuredClone(target.extra.xiaobaiOsDice);
    const wall = parseDiceRecords(raw).checks[0];
    host.source.chat = [target];
    t.mock.method(Math, 'random', () => assert.fail('retained markers never reroll'));
    for (const body of ['Edited approach. [dice:wall]', 'Reordered. [dice:door] Moved wall. [dice:wall]']) {
        target.mes = body;
        await adapter.retry(0);
        assert.equal(target.mes, body + '\n\nAfterward.');
        assert.deepEqual(JSON.parse(host.requests.at(-1).prompt.split('\n').at(-1)).at(-1), projectActionCheckResults([wall])[0]);
        assert.equal(adapter.view(), null);
        assert.deepEqual(target.extra.xiaobaiOsDice, raw);
    }
    assert.equal(host.requests.length, 2);
});

// The native event boundary is the cheapest place to verify installation, request projection and cleanup together.
test('each generation uses the current frequency, including continuations with already-confirmed results', async t => {
    setup(t);
    const prompts = new Set();
    for (const frequency of ['standard', 'active']) {
        host.frequency = frequency;
        await begin();
        await host.intercept('normal');
        assert.equal(host.prompts.get('xiaobai_os_dice'), buildActionCheckPrompt(host.source.chat.at(-1).mes, [], frequency));
        prompts.add(host.prompts.get('xiaobai_os_dice'));
    }
    assert.equal(prompts.size, 2, 'the two preferences produce distinct model instructions');
    const saved = prepareActionCheck({ body: call, generatedFrom: 0, id: 'saved', random: () => 0.4 });
    host.source.chat.push({ ...message(saved.body), extra: { xiaobaiOsDice: saved.records } });
    for (const frequency of ['standard', 'active']) {
        host.frequency = frequency;
        await begin('continue');
        await host.intercept('continue');
        assert.equal(host.prompts.get('xiaobai_os_dice'), buildActionCheckPrompt(saved.body, saved.records.checks, frequency));
        assert.deepEqual(host.source.chat.at(-1).extra.xiaobaiOsDice, saved.records, 'switching frequency preserves rolled results');
    }
    host.enabled = false;
    await begin();
    await host.intercept('normal');
    assert.equal(host.prompts.get('xiaobai_os_dice'), '');
});

test('CoC checks apply once and retry a failed continuation without rolling or revealing again', async t => {
    let reveals = 0;
    const adapter = setup(t, false, async () => { reveals++; });
    host.rule = 'coc7';
    const samples = [0.5, 0.1];
    let draws = 0;
    t.mock.method(Math, 'random', () => { assert.ok(draws < samples.length); return samples[draws++]; });
    const original = cocCall + '\n</fictional_scenarios>';
    host.source.chat = [{ ...message(original), swipe_id: 1, swipes: ['Inactive', original],
        swipe_info: [{ extra: { foreign: 1 } }, { extra: { foreign: 2 } }] }];
    await begin(); await host.intercept('normal');
    await host.saveNative();
    host.reply = async () => { throw new Error('provider unavailable'); };
    await received(); await received(); await settled(adapter);
    assert.equal(adapter.view().phase.kind, 'continue-error');
    assert.equal(draws, 2);
    assert.equal(reveals, 1);
    const current = host.source.chat[0];
    const records = structuredClone(current.extra.xiaobaiOsDice);
    assert.equal(current.mes, `[dice:${records.checks[0].id}]`, 'continuation starts at the saved result, without the preset suffix');
    assert.equal(records.checks.length, 1);
    assert.equal(records.checks[0].rule, 'coc7');
    assert.equal(records.checks[0].result.verdict, 'achieved');
    assert.equal(current.swipes[1], current.mes);
    assert.deepEqual(current.swipe_info[1].extra.xiaobaiOsDice, records);
    assert.deepEqual(current.swipe_info[0], { extra: { foreign: 1 } });
    assert.equal(current.swipes[0], 'Inactive');
    host.rule = 'd20'; adapter.cancel();
    host.reply = async () => { current.mes += '\nThe door opens.'; await host.emit('MESSAGE_RECEIVED', 0, 'appendFinal'); };
    await adapter.retry(0);
    assert.equal(draws, 2);
    assert.equal(reveals, 1);
    assert.equal(host.nativeSaves.length, 2, 'only the native pre-check and completed continuation saves');
    assert.deepEqual(parseDiceRecords(host.nativeSaves.at(-1)[0].extra.xiaobaiOsDice), records);
    assert.equal(host.requests.length, 2);
    assert.deepEqual(JSON.parse(host.requests.at(-1).prompt.split('\n').at(-1)), projectActionCheckResults(records.checks));
    assert.equal(adapter.isBusy(), false);
});

test('retrying a retained CoC chain does not read the current player sheet again', async t => {
    const adapter = setup(t);
    host.rule = 'coc7';
    host.source.chat = [message(cocCall)];
    host.reply = async () => { throw new Error('provider unavailable'); };
    await begin(); await host.intercept('normal'); await received(); await settled(adapter);
    const reads = host.sheetReads;
    const records = structuredClone(host.source.chat[0].extra.xiaobaiOsDice);
    host.sheet = null;
    host.reply = async () => { host.source.chat[0].mes += '\nFinished.'; await host.emit('MESSAGE_RECEIVED', 0, 'appendFinal'); };
    await adapter.retry(0);
    assert.equal(host.sheetReads, reads);
    assert.deepEqual(host.source.chat[0].extra.xiaobaiOsDice, records);
});

test('native stream UI ending before MESSAGE_RECEIVED still resolves CoC; failures without a message release the selector', async t => {
    const adapter = setup(t);
    host.rule = 'coc7';
    host.source.chat = [message(cocCall)];
    await begin(); host.lock(); await host.intercept('normal');
    assert.equal(adapter.isBusy(), true);
    assert.equal(host.busyViews.at(-1), true, 'the settings page receives native generation occupancy');
    host.unlock(); // ST 1.18 finalizeIntermediaryMessage unlocks before emitting the reply.
    await received(); await settled(adapter);
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice.checks[0].rule, 'coc7');
    assert.equal(adapter.isBusy(), false);
    await begin(); host.lock(); await host.intercept('normal');
    host.unlock(); // A provider error without MESSAGE_RECEIVED must not leave a persistent UI lock.
    assert.equal(adapter.isBusy(), false);
});

test('the reply snapshot survives edits and rule changes; next replies capture the new configuration', async t => {
    const adapter = setup(t);
    host.rule = 'coc7';
    Object.assign(host.sheet.attributes, { body: 40, mind: 50, will: 60, appearance: 50 });
    host.source.chat = [message(cocCall)];
    await begin(); await host.intercept('normal');
    Object.assign(host.sheet.attributes, { body: 80, mind: 50, will: 20, appearance: 50 });
    host.rule = 'd20';
    let continuations = 0;
    host.reply = async () => {
        host.source.chat[0].mes += ++continuations === 1 ? '\n\n' + cocCall : '\nFinished.';
        await host.emit('MESSAGE_RECEIVED', 0, 'appendFinal');
    };
    await received(); await settled(adapter);
    const records = host.source.chat[0].extra.xiaobaiOsDice.checks;
    assert.deepEqual(records.map(record => [record.rule, record.result.value]), [['coc7',40],['coc7',40]]);
    host.rule = 'coc7';
    host.source.chat = [message(cocCall)];
    await begin(); await host.intercept('normal');
    await received(); await settled(adapter);
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice.checks[0].result.value, 80);
});

test('uninitialized CoC has no request prompt and cannot roll, but saved results can still resume', async t => {
    const adapter = setup(t);
    host.rule = 'coc7'; host.sheet = null;
    host.source.chat = [message('Ordinary conversation.')];
    await begin(); await host.intercept('normal');
    assert.equal(host.prompts.get('xiaobai_os_dice'), '');
    await received(); await settled(adapter);
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice, undefined);
    const retained = prepareActionCheck({ body: cocCall, rule: 'coc7', coc7Sheet: generateCoc7Sheet(() => 0.5), generatedFrom: 0, id: 'retained' });
    host.source.chat = [{ ...message(retained.body), extra: { xiaobaiOsDice: retained.records } }];
    t.mock.method(Math, 'random', () => assert.fail('history retry must not roll'));
    await adapter.retry(0);
    assert.deepEqual(host.source.chat[0].extra.xiaobaiOsDice, retained.records);
    assert.equal(adapter.view(), null);
});

test('a damaged stored sheet does not abort ordinary chat or enable CoC rolls', async t => {
    const adapter = setup(t);
    host.rule = 'coc7';
    host.sheet = { ...host.sheet, luck: '50' };
    const raw = structuredClone(host.sheet);
    t.mock.method(Math, 'random', () => assert.fail('a damaged sheet must not roll'));
    host.source.chat = [message('Ordinary conversation.')];
    await begin();
    assert.equal(await host.intercept('normal'), false);
    assert.equal(host.prompts.get('xiaobai_os_dice'), '');
    await received(); await settled(adapter);
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice, undefined);
    host.source.chat = [message(cocCall)];
    await begin(); await host.intercept('normal'); await received(); await settled(adapter);
    assert.equal(adapter.view().phase.kind, 'invalid');
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice, undefined);
    assert.deepEqual(host.sheet, raw);
});

test('final requests hide Dice markers without changing source messages, non-text parts or result data', async t => {
    setup(t);
    const saved = prepareActionCheck({ body: call, generatedFrom: 0, id: 'saved', random: () => 0.4 });
    host.source.chat.push({ ...message(saved.body), extra: { xiaobaiOsDice: saved.records } });
    await begin('continue');
    await host.intercept('continue');
    const resultsPrompt = host.prompts.get('xiaobai_os_dice');
    assert.ok(resultsPrompt);
    const sourceMessages = [
        { role: 'system', content: resultsPrompt },
        { role: 'assistant', content: saved.body, extra: host.source.chat.at(-1).extra },
        { role: 'user', content: [
            { type: 'text', text: 'Before[dice:saved]\n[dice:second-ID_2]After [image:keep] [ordinary] <xb_action_check>' },
            { type: 'image_url', image_url: { url: 'https://example.test/[dice:keep].png' } },
        ] },
        { role: 'assistant', content: null, tool_calls: [{ id: 'keep', function: { arguments: '[dice:keep]' } }] },
        { role: 'assistant', tool_calls: [] },
    ];
    const original = structuredClone(sourceMessages);
    const savedChat = structuredClone(host.source.chat);
    const data = { prompt: sourceMessages, temperature: 0.5 };
    await host.emit('GENERATE_AFTER_DATA', data, false);
    assert.equal(data.prompt[0].content, resultsPrompt);
    assert.equal(data.prompt[1].content, 'Attempt.\n\n');
    assert.equal(data.prompt[2].content[0].text, 'Before\nAfter [image:keep] [ordinary] <xb_action_check>');
    assert.deepEqual(data.prompt[2].content[1], original[2].content[1]);
    assert.deepEqual(data.prompt.slice(3), original.slice(3));
    assert.deepEqual(sourceMessages, original, 'host-owned prompt objects are not mutated');
    assert.deepEqual(host.source.chat, savedChat, 'body, records and continuation anchors remain unchanged');
    assert.equal(data.temperature, 0.5);
    assert.equal(host.prompts.get('xiaobai_os_dice'), '', 'normal prompt cleanup still runs after assembly');
});

test('historical Dice markers filter for text requests and previews even with checks disabled', async t => {
    setup(t);
    host.enabled = false;
    host.prompts.set('xiaobai_os_dice', 'Pending result data');
    const original = 'Before\n[dice:one][dice:two-ID_3]\nAfter [image:keep] [ordinary] [dice:] [dice:unfinished';
    for (const dryRun of [true, false]) {
        const data = { prompt: original, max_length: 80 };
        await host.emit('GENERATE_AFTER_DATA', data, dryRun);
        assert.equal(data.prompt, 'Before\n\nAfter [image:keep] [ordinary] [dice:] [dice:unfinished');
        assert.equal(data.max_length, 80);
        assert.equal(host.prompts.get('xiaobai_os_dice'), dryRun ? 'Pending result data' : '');
    }
    assert.equal(host.requests.length, 0);
});

test('NovelAI input hides Dice markers without requiring or adding a prompt field', async t => {
    setup(t);
    host.enabled = false;
    for (const dryRun of [true, false]) {
        const data = { input: 'Before[dice:one]\n[dice:two-ID_3]After [ordinary]', model: 'kayra-v1', use_string: true };
        await host.emit('GENERATE_AFTER_DATA', data, dryRun);
        assert.deepEqual(data, { input: 'Before\nAfter [ordinary]', model: 'kayra-v1', use_string: true });
    }
});

test('CFG requests hide Dice markers in both positive and negative context', async t => {
    setup(t);
    const source = 'History[dice:one]\nContinuation[dice:two-ID_3]';
    host.source.chat.at(-1).mes = source;
    const data = { prompt: source, negative_prompt: source + '\nAvoid repetition', guidance_scale: 1.5,
        stopping_strings: ['[dice:keep]'] };
    await host.emit('GENERATE_AFTER_DATA', data, false);
    assert.deepEqual(data, { prompt: 'History\nContinuation', negative_prompt: 'History\nContinuation\nAvoid repetition',
        guidance_scale: 1.5, stopping_strings: ['[dice:keep]'] });
    assert.equal(host.source.chat.at(-1).mes, source);
});

test('Dice request filtering detaches on stop and reattaches on restart', async t => {
    const adapter = setup(t);
    await adapter.stop();
    const stopped = { prompt: 'Before[dice:one]After' };
    await host.emit('GENERATE_AFTER_DATA', stopped, false);
    assert.equal(stopped.prompt, 'Before[dice:one]After');
    adapter.start();
    adapter.start();
    const restarted = { prompt: stopped.prompt };
    await host.emit('GENERATE_AFTER_DATA', restarted, false);
    assert.equal(restarted.prompt, 'BeforeAfter');
});

test('ordinary prose, examples and invalid requests never acquire post-processing controls', async t => {
    const adapter = setup(t);
    const block = call.slice(call.indexOf('<xb_action_check>'));
    const bodies = ['Plain reply.', '```json\n' + block + '\n```', '~~~\n' + block + '\n~~~',
        '`' + block + '`', '> ' + block, '> Example:\n' + block, '    ' + block,
        block.slice(0, -4), block.replace('hard', 'unknown'), '<xb_action_check>{bad}</xb_action_check>\n</fictional_scenarios>', block + '\n' + block];
    for (const body of bodies) {
        await begin(); await host.intercept('normal');
        host.lock();
        const nativeLocks = host.locks;
        host.source.chat.push(message(body)); await received();
        assert.equal(host.locks, nativeLocks, body);
        host.unlock(); await setImmediate();
        assert.equal(host.stopVisible, false, body);
        assert.equal(host.busy, false, body);
        assert.equal(host.requests.length, 0, body);
    }
    host.source.chat.push(message(call));
    await begin('continue'); await host.intercept('continue');
    host.source.chat.at(-1).mes += '\nNormal continuation.';
    await received();
    assert.equal(adapter.view(), null, 'an old request is not a newly generated check');
    assert.equal(host.busy, false);
});

test('one check uses only native pre-check and post-continuation saves while busy ownership spans reveal', async t => {
    const revealing = Promise.withResolvers();
    const continuing = Promise.withResolvers();
    const adapter = setup(t, false, () => revealing.promise);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    await begin(); await host.intercept('normal');
    host.lock();
    const target = { ...message(call), swipe_id: 0, swipes: [call], swipe_info: [{ extra: { foreign: true } }] };
    host.source.chat.push(target);
    const reply = host.reply;
    host.reply = async () => { await continuing.promise; await reply(); };
    await received(); await received();
    assert.equal(adapter.view().phase.kind, 'settling');
    assert.equal(target.extra.xiaobaiOsDice, undefined, 'native generation occupancy must be released before rolling');
    await host.saveNative();
    host.unlock(); await setImmediate();
    assert.equal(host.busy, true);
    assert.equal(host.stopVisible, true);
    assert.equal(host.dataGenerating, true, 'native cleanup must not erase the processing indicator');
    t.mock.timers.tick(40); await setImmediate();
    assert.equal(adapter.view().phase.kind, 'revealing');
    assert.equal(host.nativeSaves.length, 1);
    assert.equal(host.nativeSaves[0].at(-1).mes, call);
    assert.equal(host.nativeSaves[0].at(-1).extra.xiaobaiOsDice, undefined);
    assert.equal(target.extra.xiaobaiOsDice.checks.length, 1);
    assert.equal(host.busy, true);
    assert.equal(host.requests.length, 0);
    assert.equal(host.stopVisible, true);
    revealing.resolve(); await setImmediate();
    assert.equal(adapter.view().phase.kind, 'continuing');
    assert.equal(host.requests.length, 1);
    assert.equal(host.stopVisible, true);
    continuing.resolve(); await settled(adapter);
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
    assert.equal(host.dataGenerating, false);
    assert.equal(target.extra.xiaobaiOsDice.checks.length, 1, 'duplicate completion events cannot roll twice');
    assert.equal(host.nativeSaves.length, 2, 'there is no intermediate Dice save');
    const reloaded = JSON.parse(JSON.stringify(host.nativeSaves.at(-1))).at(-1);
    assert.equal(reloaded.mes, target.mes);
    assert.deepEqual(reloaded.extra.xiaobaiOsDice, target.extra.xiaobaiOsDice);
    assert.deepEqual(reloaded.swipe_info[0].extra.xiaobaiOsDice, target.extra.xiaobaiOsDice);
    assert.equal(reloaded.swipe_info[0].extra.foreign, true);
    // A normal next floor uses the finished prose, not the preceding floor's roll injection.
    await begin('normal'); await host.intercept('normal');
    assert.equal(host.prompts.get('xiaobai_os_dice'), buildActionCheckPrompt(target.mes));
});

for (const replacement of [false, true]) {
    test(`${replacement ? 'a replacement generation' : 'Stop'} cancels delayed reveal without late continuation or control theft`, async t => {
        const revealing = Promise.withResolvers();
        const adapter = setup(t, false, () => revealing.promise);
        await adapter.stop();
        const otherListener = Promise.withResolvers();
        const event = replacement ? 'GENERATION_STARTED' : 'GENERATION_STOPPED';
        let blocked = false;
        t.after(host.listen(event, () => blocked ? otherListener.promise : undefined));
        adapter.start();
        await begin(); await host.intercept('normal');
        host.source.chat.push(message(call)); await received(); await setImmediate();
        assert.equal(adapter.view().phase.kind, 'revealing');
        assert.equal(host.stopVisible, true);
        blocked = true;
        let starting;
        if (replacement) {
            host.lock(); starting = begin();
        } else { host.stop(); }
        await setImmediate();
        assert.equal(adapter.view(), null, 'cancellation must precede unrelated slow native listeners');
        assert.equal(host.busy, replacement);
        assert.equal(host.stopVisible, replacement);
        revealing.resolve(); await setImmediate();
        assert.equal(host.requests.length, 0);
        assert.equal(host.busy, replacement);
        assert.equal(host.stopVisible, replacement);
        assert.equal(host.prompts.get('xiaobai_os_dice'), '');
        otherListener.resolve(); await starting;
    });
}

for (const mode of ['request', 'stream', 'already-stopped']) {
    const streaming = mode === 'stream';
    test(`replacement generation cancels the old ${mode} and waits for its native cleanup`, async t => {
        const adapter = setup(t);
        const cleanup = Promise.withResolvers();
        const replacementReply = Promise.withResolvers();
        t.after(() => { cleanup.resolve(); replacementReply.resolve(); });
        const streamController = new AbortController();
        const normalReply = host.reply;
        host.reply = async signal => {
            if (host.requests.length === 1) {
                if (streaming) host.stream = { isStopped: false,
                    onStopStreaming() { streamController.abort(); this.isStopped = true; } };
                await cleanup.promise;
                host.stream = null;
                (streaming ? streamController.signal : signal).throwIfAborted();
                await normalReply();
            } else { await replacementReply.promise; await normalReply(); }
        };
        await begin(); await host.intercept('normal');
        const target = message(call); host.source.chat.push(target);
        await received(); await setImmediate();
        assert.equal(host.requests.length, 1);
        const oldSignal = host.requests[0].signal;
        if (mode === 'already-stopped') { host.stop(); await setImmediate(); }
        // Native callers may install their controller before emitting GENERATION_STARTED.
        const nextController = new AbortController(); host.controller = nextController;
        const replacement = host.generate('normal', { signal: nextController.signal, depth: 1 });
        await setImmediate();
        assert.equal(oldSignal.aborted, true);
        if (streaming) assert.equal(streamController.signal.aborted, true);
        assert.equal(nextController.signal.aborted, false, 'cancellation must not stop the incoming request');
        assert.equal(host.requests.length, 1, 'the old native finalizer must finish before dispatching a new request');
        assert.equal(host.busy, true);
        assert.equal(host.stopVisible, true, 'waiting for the old native call remains stoppable');
        cleanup.resolve(); await setImmediate();
        assert.equal(host.requests.length, 2);
        assert.equal(host.busy, true);
        assert.equal(host.stopVisible, true);
        assert.equal(target.mes, 'Attempt.\n\n[dice:generated-0]', 'the aborted request cannot append late text');
        replacementReply.resolve(); await replacement;
        assert.equal(adapter.view(), null);
        assert.equal(host.busy, false);
        assert.equal(host.stopVisible, false);
    });
}

test('Stop during replacement handoff prevents the incoming native call from dispatching', async t => {
    const adapter = setup(t);
    const cleanup = Promise.withResolvers();
    t.after(() => cleanup.resolve());
    host.reply = async signal => { await cleanup.promise; signal.throwIfAborted(); };
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call)); await received(); await setImmediate();
    const replacement = host.generate('normal', { depth: 1 });
    await setImmediate();
    assert.equal(host.requests.length, 1);
    assert.equal(host.stopVisible, true);
    host.stop(); await setImmediate();
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
    cleanup.resolve(); await replacement;
    assert.equal(host.requests.length, 1);
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
    assert.equal(adapter.view(), null);
});

// Explicit same-roll recovery must not wait for a cancelled native call's I/O.
// Exercise the real adapter with delayed requests/saves and out-of-order completion.
for (const rule of ['d20', 'coc7']) {
    for (const pending of ['request', 'save']) {
        test(`${rule} retry after Stop dispatches before the old ${pending} finishes and retains ownership`, async t => {
            let reveals = 0;
            const adapter = setup(t, false, async () => { reveals++; });
            host.rule = rule;
            const cleanup = Promise.withResolvers();
            const retryReply = Promise.withResolvers();
            t.after(() => { cleanup.resolve(); retryReply.resolve(); });
            const nativeSave = host.saveNative;
            let saves = 0;
            t.mock.method(host, 'saveNative', async () => {
                if (++saves === 1 && pending === 'save') { await cleanup.promise; }
                await nativeSave();
            });
            host.reply = async signal => {
                if (host.requests.length === 1) {
                    if (pending === 'request') { await cleanup.promise; signal.throwIfAborted(); }
                    host.unlock();
                    await host.emit('MESSAGE_RECEIVED', 1, 'continue');
                } else {
                    await retryReply.promise;
                    signal.throwIfAborted();
                    host.source.chat.at(-1).mes += '\n\nAfterward.';
                    await host.emit('MESSAGE_RECEIVED', 1, 'continue');
                }
            };
            await begin(); await host.intercept('normal');
            const target = message(rule === 'd20' ? call : cocCall); host.source.chat.push(target);
            await received(); await setImmediate();
            assert.equal(host.requests.length, 1);
            const saved = structuredClone(target.extra.xiaobaiOsDice);
            host.stop(); await setImmediate();
            assert.equal(host.requests[0].signal.aborted, true);
            const retry = adapter.retry(1); await setImmediate();
            assert.equal(host.requests.length, 2, 'retry dispatch must precede old I/O completion');
            await assert.rejects(adapter.retry(1));
            assert.equal(host.ids, 1);
            assert.equal(reveals, 1);
            cleanup.resolve(); await setImmediate();
            assert.equal(host.requests[1].signal.aborted, false);
            assert.equal(adapter.view().phase.kind, 'continuing');
            assert.equal(host.busy, true);
            assert.equal(host.stopVisible, true);
            retryReply.resolve(); await retry;
            assert.equal(host.requests.length, 2);
            assert.deepEqual(target.extra.xiaobaiOsDice, saved);
            assert.equal(adapter.view(), null);
            assert.equal(host.busy, false);
        });
    }
}

for (const failed of [false, true]) {
    test(`cancelled preparation ${failed ? 'failure' : 'completion'} cannot clear the retry prompt`, async t => {
        const adapter = setup(t);
        await begin(); await host.intercept('normal');
        const preparing = Promise.withResolvers();
        const assembly = Promise.withResolvers();
        t.after(() => { preparing.resolve(); assembly.resolve(); });
        let preparations = 0;
        host.preflight = async () => { if (++preparations === 1) { await preparing.promise; } };
        // Native prompt assembly continues asynchronously after extension interceptors.
        const intercept = host.intercept;
        t.mock.method(host, 'intercept', async type => {
            const aborted = await intercept(type);
            if (!aborted) { await assembly.promise; }
            return aborted;
        });
        const target = message(call); host.source.chat.push(target);
        await received(); await setImmediate();
        const saved = structuredClone(target.extra.xiaobaiOsDice);
        host.stop(); await setImmediate();
        const retry = adapter.retry(1); await setImmediate();
        const retryPrompt = host.prompts.get('xiaobai_os_dice');
        assert.ok(retryPrompt);
        if (failed) { preparing.reject(new Error('preparation_failed')); }
        else { preparing.resolve(); }
        await setImmediate();
        assert.equal(host.prompts.get('xiaobai_os_dice'), retryPrompt);
        assert.equal(host.busy, true);
        assembly.resolve(); await retry;
        assert.equal(host.requests.length, 1, 'only the retry reaches the provider');
        assert.equal(host.requests[0].prompt, retryPrompt);
        assert.equal(host.ids, 1);
        assert.deepEqual(target.extra.xiaobaiOsDice, saved);
        assert.equal(adapter.view(), null);
    });
}

test('a stopped call finishing after its successful retry cannot revive the old Dice run', async t => {
    const adapter = setup(t);
    const cleanup = Promise.withResolvers();
    t.after(() => cleanup.resolve());
    const nativeSave = host.saveNative;
    let saves = 0;
    t.mock.method(host, 'saveNative', async () => {
        if (++saves === 1) { await cleanup.promise; }
        await nativeSave();
    });
    const normalReply = host.reply;
    host.reply = async () => { if (host.requests.length > 1) { await normalReply(); } };
    await begin(); await host.intercept('normal');
    const target = message(call); host.source.chat.push(target);
    await received(); await setImmediate();
    host.stop(); await setImmediate();
    const retry = adapter.retry(1); await setImmediate();
    assert.equal(host.requests.length, 2);
    await retry;
    const completed = structuredClone(target);
    assert.equal(adapter.view(), null);
    cleanup.resolve(); await setImmediate();
    assert.deepEqual(target, completed);
    assert.equal(adapter.view(), null);
    assert.equal(host.busy, false);
    assert.equal(host.ids, 1);
});

test('native auto-swipe can re-enter Generate from the completed continuation without waiting on itself', { timeout: 2000 }, async t => {
    const adapter = setup(t);
    const completed = Promise.withResolvers();
    const normalReply = host.reply;
    host.reply = async () => {
        await normalReply();
        const target = host.source.chat.at(-1);
        target.swipe_id = 1; target.mes = '';
        await host.emit('MESSAGE_SWIPED', host.source.chat.length - 1);
        host.reply = normalReply;
        await host.generate('swipe');
        completed.resolve();
    };
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call)); await received();
    await completed.promise; await setImmediate();
    assert.equal(host.requests.length, 2);
    assert.equal(host.source.chat.at(-1).extra.xiaobaiOsDice, undefined);
    assert.equal(adapter.view(), null);
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
});

test('continuation progress follows native preparation and response events without inventing a save wait', async t => {
    const adapter = setup(t);
    const prepared = prepareActionCheck({ body: call, generatedFrom: 0, id: 'progress', random: () => .3 });
    host.source.chat = [message(prepared.body)];
    host.source.chat[0].extra.xiaobaiOsDice = prepared.records;
    const preparing = Promise.withResolvers(), requesting = Promise.withResolvers(), reply = Promise.withResolvers();
    const normalReply = host.reply;
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    host.preflight = () => preparing.promise;
    host.reply = async () => { requesting.resolve(); await reply.promise; await normalReply(); };
    const operation = adapter.retry(0);
    await setImmediate();
    assert.deepEqual(adapter.view().continuation, { stage: 'preparing', elapsedSeconds: 0 });
    now += 3500;
    assert.deepEqual(adapter.view().continuation, { stage: 'preparing', elapsedSeconds: 3 });
    await host.emit('GENERATE_AFTER_DATA', {}, true);
    assert.equal(adapter.view().continuation.stage, 'preparing', 'dry runs cannot advance the live request');
    preparing.resolve(); await requesting.promise;
    assert.deepEqual(adapter.view().continuation, { stage: 'requesting', elapsedSeconds: 0 });
    now += 7000;
    assert.equal(adapter.view().continuation.elapsedSeconds, 7);
    await host.emit('STREAM_TOKEN_RECEIVED', '');
    assert.deepEqual(adapter.view().continuation, { stage: 'responding', elapsedSeconds: 0 });
    assert.equal(host.source.chat[0].mes, prepared.body, 'response chunks need not contain visible prose yet');
    now += 2000;
    await host.emit('STREAM_TOKEN_RECEIVED', '');
    assert.equal(adapter.view().continuation.elapsedSeconds, 2, 'more chunks do not reset stage time');
    reply.resolve(); await operation;
    assert.equal(adapter.view(), null);
    assert.equal(host.requests.length, 1);
    assert.deepEqual(host.source.chat[0].extra.xiaobaiOsDice, prepared.records);
});

test('Stop cancels a continuation retry during native preparation without another request', async t => {
    const adapter = setup(t);
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call));
    host.reply = async () => { throw new Error('provider unavailable'); };
    await received(); await settled(adapter);
    assert.equal(adapter.view().phase.kind, 'continue-error');
    const requests = host.requests.length;
    const preparing = Promise.withResolvers();
    host.preflight = () => preparing.promise;
    host.stream = { isStopped: false };
    const retry = adapter.retry(1);
    await setImmediate();
    assert.equal(adapter.view().continuation.stage, 'preparing');
    assert.equal(host.busy, true);
    assert.equal(host.stopVisible, true);
    host.stop(); await setImmediate();
    assert.equal(adapter.view(), null);
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
    preparing.resolve(); await retry;
    assert.equal(host.requests.length, requests);
});

test('successive checks in one reply retain busy ownership across native continuation unlocks', async t => {
    const adapter = setup(t);
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call));
    const finalReply = host.reply;
    host.reply = async () => {
        host.source.chat.at(-1).mes += '\n\n' + call;
        await host.emit('MESSAGE_RECEIVED', host.source.chat.length - 1, 'appendFinal');
        host.reply = finalReply;
    };
    await received(); await settled(adapter);
    assert.equal(host.requests.length, 2);
    assert.ok(host.requests.every(request => request.busy));
    assert.equal(host.source.chat.at(-1).extra.xiaobaiOsDice.checks.length, 2);
    assert.equal(host.stopVisible, false);
    assert.equal(host.busy, false);
});

for (const mode of ['single', 'group-member', 'group-finished']) {
    test(`autonomous ${mode} continuation preserves an unsent draft and writes only the original AI floor`, async t => {
        const adapter = setup(t, mode !== 'single');
        if (mode !== 'single') host.group(true);
        await begin('normal', { signal: new AbortController().signal });
        await host.intercept('normal');
        const target = message(call);
        host.source.chat.push(target);
        host.draft = '/echo UNSENT_DRAFT';
        await received();
        if (mode === 'group-member') await host.emit('GROUP_MEMBER_DRAFTED');
        if (mode === 'group-finished') { host.group(false); await host.emit('GROUP_WRAPPER_FINISHED'); }
        await settled(adapter);
        assert.equal(host.draft, '/echo UNSENT_DRAFT');
        assert.equal(host.source.chat.length, 2);
        assert.equal(host.source.chat.at(-1), target);
        assert.equal(target.mes, 'Attempt.\n\n[dice:generated-0]\n\nAfterward.');
        assert.equal(target.extra.xiaobaiOsDice.checks.length, 1);
        assert.equal(host.requests.length, 1);
        assert.equal(host.requests[0].busy, true);
        assert.equal(host.busy, false);
        const data = JSON.parse(host.requests[0].prompt.split('\n').at(-1));
        assert.equal(data[0].roll, target.extra.xiaobaiOsDice.checks[0].roll);
    });
}

test('native regenerate deletion preserves the new generation, but a later user deletion still cancels it', async t => {
    const adapter = setup(t);
    await begin('regenerate');
    host.source.chat.pop();
    await host.emit('MESSAGE_DELETED', 0);
    await host.intercept('regenerate');
    host.source.chat.push(message(call));
    await received();
    await settled(adapter);
    assert.equal(host.requests.length, 1);
    assert.equal(host.source.chat[0].extra.xiaobaiOsDice.checks.length, 1);

    await begin('regenerate');
    host.source.chat.pop();
    await host.emit('MESSAGE_DELETED', 0);
    await host.intercept('regenerate');
    host.source.chat.push(message(call));
    await host.emit('MESSAGE_DELETED', 0);
    await received();
    await settled(adapter);
    assert.equal(host.requests.length, 1);
});

test('reveal owns native busy/Stop controls and late completion cannot unlock a replacement generation', async t => {
    let release;
    let shown;
    const revealing = new Promise(resolve => { shown = resolve; });
    const adapter = setup(t, false, async () => {
        shown(); await new Promise(resolve => { release = resolve; });
    });
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call)); await received(); await revealing;
    assert.equal(host.busy, true);
    assert.equal(host.stopVisible, true);
    assert.equal(host.requests.length, 0);
    await host.emit('GENERATION_STOPPED');
    assert.equal(host.busy, false);
    assert.equal(host.stopVisible, false);
    assert.equal(adapter.view(), null);
    host.busy = true; host.stopVisible = true; // A later native generation now owns the controls.
    release(); await setImmediate();
    assert.equal(host.busy, true);
    assert.equal(host.stopVisible, true);
    assert.equal(host.requests.length, 0);
    assert.equal(host.source.chat.at(-1).extra.xiaobaiOsDice.checks.length, 1);
});

for (const change of ['edit', 'chat', 'swipe']) {
    test(`${change} during reveal keeps the local result but prevents late continuation`, async t => {
        const revealing = Promise.withResolvers();
        let signal;
        const adapter = setup(t, false, async (_target, _candidate, currentSignal) => { signal = currentSignal; await revealing.promise; });
        await begin(); await host.intercept('normal');
        const target = message(call); host.source.chat.push(target);
        await received(); await setImmediate();
        const records = structuredClone(target.extra.xiaobaiOsDice);
        if (change === 'edit') { target.mes = 'User edit. [dice:generated-0]'; await host.emit('MESSAGE_EDITED', 1); }
        if (change === 'chat') { host.source = { ...host.source, key: 'other', chat: [message('Other chat')] }; await host.emit('CHAT_CHANGED'); }
        if (change === 'swipe') { target.swipe_id = 1; target.mes = 'Other swipe'; await host.emit('MESSAGE_SWIPED', 1); }
        const body = target.mes;
        assert.equal(signal.aborted, true);
        revealing.resolve(); await setImmediate();
        assert.equal(adapter.view(), null);
        assert.equal(host.requests.length, 0);
        assert.equal(target.mes, body);
        assert.deepEqual(target.extra.xiaobaiOsDice, records);
    });
}

test('shutdown does not roll back the local result, while reload only sees the last native save', async t => {
    const revealing = Promise.withResolvers();
    const adapter = setup(t, false, () => revealing.promise);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    await begin(); await host.intercept('normal');
    host.lock(); const target = message(call); host.source.chat.push(target);
    await received(); await host.saveNative(); host.unlock();
    t.mock.timers.tick(40); await setImmediate();
    assert.equal(adapter.view().phase.kind, 'revealing');
    const records = structuredClone(target.extra.xiaobaiOsDice);
    adapter.stop();
    assert.equal(adapter.view(), null);
    assert.deepEqual(target.extra.xiaobaiOsDice, records, 'stopping leaves the result in the current message');
    host.source.chat = structuredClone(host.nativeSaves[0]);
    assert.equal(host.source.chat.at(-1).mes, call);
    assert.equal(host.source.chat.at(-1).extra.xiaobaiOsDice, undefined, 'an unsaved result is not restored from a separate cache');
    adapter.start(); revealing.resolve(); await setImmediate();
    assert.equal(host.requests.length, 0, 'reload never re-executes a historical request');
    assert.equal(host.nativeSaves.length, 1);
    assert.equal(adapter.view(), null);
});

test('disabled checks still isolate a new swipe and preserve the old candidate and unrelated fields', async t => {
    setup(t);
    const original = prepareActionCheck({ body: call, generatedFrom: 0, id: 'old', random: () => .4 });
    const oldExtra = { xiaobaiOsDice: original.records, other: 'retained' };
    const target = { ...message(original.body), swipe_id: 1, swipes: [original.body, ''], extra: structuredClone(oldExtra),
        swipe_info: [{ extra: oldExtra }, { extra: structuredClone(oldExtra) }] };
    host.source.chat = [target]; host.enabled = false;
    await begin('swipe');
    await host.intercept('swipe');
    target.mes = 'A different reply.';
    await received();
    assert.equal(target.extra.xiaobaiOsDice, undefined);
    assert.equal(target.swipe_info[1].extra.xiaobaiOsDice, undefined);
    assert.deepEqual(target.swipe_info[0].extra.xiaobaiOsDice, original.records);
    assert.equal(target.extra.other, 'retained');
    assert.equal(host.requests.length, 0);
});

test('a target changed during continuation preparation is rejected before any provider request', async t => {
    const adapter = setup(t);
    await begin();
    await host.intercept('normal');
    const target = message(call);
    host.source.chat.push(target);
    host.preflight = async () => { host.source.chat.push({ mes: 'New user message', is_user: true, extra: {} }); };
    await received();
    await settled(adapter);
    assert.equal(target.extra.xiaobaiOsDice.checks.length, 1);
    assert.equal(host.requests.length, 0);
    assert.equal(host.source.chat.at(-1).mes, 'New user message');
    assert.equal(host.busy, false);
});

test('readiness follows native generation occupancy without waiting for or clearing the stream', async t => {
    setup(t);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const target = captureDiceTarget(captureDiceChat(), 0, 0);
    host.saving(true);
    const stream = { isStopped: false, isFinished: true };
    host.stream = stream; host.busy = true;
    let ready = false;
    const operation = waitForDiceHost(target, new AbortController().signal, false).then(() => { ready = true; });
    await setImmediate();
    assert.equal(ready, false, 'native generation occupancy still blocks admission');
    host.group(true); host.busy = false;
    t.mock.timers.tick(40); await setImmediate();
    assert.equal(ready, false, 'the group wrapper remains busy between member generations');
    host.group(false);
    t.mock.timers.tick(40); await operation;
    assert.equal(ready, true);
    assert.equal(host.stream, stream, 'Dice must not clear native processor state');

    host.busy = true;
    const controller = new AbortController();
    const cancelled = waitForDiceHost(target, controller.signal, false);
    controller.abort();
    await assert.rejects(cancelled);
});

// Native continuation admission does not require save-idle or processor cleanup.
// Both rules must dispatch with that internal work pending; native code owns cleanup.
for (const rule of ['d20', 'coc7']) {
    for (const entry of ['automatic', 'reloaded-request', 'reloaded-result']) {
        test(`${rule} ${entry} continues while native saving and stream cleanup remain pending`, async t => {
            const adapter = setup(t);
            host.rule = rule;
            const body = rule === 'd20' ? call : cocCall;
            const target = message(body);
            let saved;
            if (entry === 'reloaded-result') {
                const candidate = prepareActionCheck({ body, records: undefined, generatedFrom: 0,
                    rule, coc7Sheet: host.sheet, id: 'persisted-check', random: () => 0.5 });
                assert.equal(candidate.kind, 'candidate');
                target.mes = candidate.body;
                target.extra.xiaobaiOsDice = candidate.records;
                saved = structuredClone(candidate.records);
            }
            if (entry === 'automatic') { await begin(); await host.intercept('normal'); }
            host.source.chat.push(JSON.parse(JSON.stringify(target)));
            const savingAtDispatch = [];
            const streamsAtDispatch = [];
            const normalReply = host.reply;
            host.reply = async () => {
                savingAtDispatch.push(host.savingActive);
                streamsAtDispatch.push(host.stream);
                await normalReply();
            };
            const stream = { isStopped: false, isFinished: true };
            host.stream = stream;
            host.saving(true);
            const operation = entry === 'automatic' ? received() : adapter.retry(1);
            await setImmediate();
            assert.deepEqual(savingAtDispatch, [true], 'native continuation starts without waiting for the save flag');
            assert.deepEqual(streamsAtDispatch, [stream], 'Dice leaves the previous processor to the host');
            await operation;
            await settled(adapter);
            assert.equal(host.requests.length, 1);
            const records = host.source.chat.at(-1).extra.xiaobaiOsDice;
            assert.equal(records.checks.length, 1);
            assert.equal(host.ids, saved ? 0 : 1);
            if (saved) { assert.deepEqual(records, saved); }
            assert.equal(adapter.view(), null);
            assert.equal(host.busy, false);
        });
    }
}

test('a failed incoming stream never rolls, and its residual processor cannot reject the next non-streaming reply', async t => {
    const adapter = setup(t);
    await begin();
    await host.intercept('normal');
    const failedReply = message(call);
    host.source.chat.push(failedReply);
    host.stream = { isStopped: true, isFinished: false };
    await received();
    await settled(adapter);
    assert.equal(host.requests.length, 0);
    assert.equal(failedReply.extra.xiaobaiOsDice, undefined);

    await begin('regenerate');
    host.source.chat.pop();
    await host.emit('MESSAGE_DELETED', 1);
    await host.intercept('regenerate');
    host.source.chat.push(message(call));
    await received();
    await settled(adapter);
    assert.equal(host.requests.length, 1);
    assert.equal(host.source.chat.at(-1).extra.xiaobaiOsDice.checks.length, 1);
});

// Host waiting is a recoverable condition, not an invalid model request. These
// exercise the real readiness timer and adapter rather than a session-only stub.
test('native generation occupancy reports elapsed time, then pauses without rolling and retries once', async t => {
    const adapter = setup(t);
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
    await begin(); await host.intercept('normal');
    const target = message(call); host.source.chat.push(target);
    host.lock();
    host.stream = { isStopped: false }; host.saving(true);
    await received();
    assert.deepEqual(adapter.view().wait, { blockers: ['generation'], elapsedSeconds: 0 });
    t.mock.timers.tick(1000); await setImmediate();
    assert.deepEqual(adapter.view().wait, { blockers: ['generation'], elapsedSeconds: 1 });
    t.mock.timers.tick(9000); await setImmediate();
    assert.equal(adapter.view().phase.kind, 'wait-error');
    assert.equal(adapter.view().wait.elapsedSeconds, 10);
    assert.equal(host.busy, true, 'pausing does not release the native generation');
    assert.equal(target.mes, call);
    assert.equal(target.extra.xiaobaiOsDice, undefined);
    assert.equal(host.ids, 0);
    assert.equal(host.requests.length, 0);

    host.unlock();
    const first = adapter.retry(1);
    await assert.rejects(adapter.retry(1)); // Native busy state also guards repeated UI clicks.
    assert.equal(adapter.view().wait, null);
    await first;
    assert.equal(target.extra.xiaobaiOsDice.checks.length, 1);
    assert.equal(host.requests.length, 1);
    assert.equal(host.ids, 1);
    assert.equal(adapter.view(), null);
});

test('reload offers explicit recovery of only the latest unrolled request and never rolls by displaying it', async t => {
    const adapter = setup(t);
    host.source.chat = [message(call), message(call)];
    assert.equal(adapter.canRetryRequest(0), false);
    assert.equal(adapter.canRetryRequest(1), true);
    assert.equal(host.ids, 0);
    assert.equal(host.requests.length, 0);
    host.busy = true;
    assert.equal(adapter.canRetryRequest(1), false);
    host.busy = false;
    await adapter.retry(1);
    assert.equal(host.source.chat[0].mes, call);
    assert.equal(host.source.chat[1].extra.xiaobaiOsDice.checks.length, 1);
    assert.equal(host.requests.length, 1);
    assert.equal(adapter.canRetryRequest(1), false);
});

test('pausing Dice releases only its own controls while a native generation is still pending', async t => {
    const adapter = setup(t);
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
    await begin(); await host.intercept('normal');
    host.source.chat.push(message(call));
    host.lock();
    await received();
    assert.deepEqual(adapter.view().wait.blockers, ['generation']);
    t.mock.timers.tick(10000); await setImmediate();
    assert.equal(adapter.view().phase.kind, 'wait-error');
    assert.equal(host.busy, true, 'native generation still owns the send controls');
    assert.equal(host.ids, 0);
    host.unlock();
    await adapter.retry(1);
    assert.equal(host.requests.length, 1);
    assert.equal(host.busy, false);
});

test('retrying a saved result ignores pending native cleanup and cannot start a duplicate continuation', async t => {
    const adapter = setup(t);
    await begin(); await host.intercept('normal');
    const target = message(call); host.source.chat.push(target);
    host.reply = async () => {};
    await received(); await settled(adapter);
    const saved = structuredClone(target.extra.xiaobaiOsDice);
    const ids = host.ids;
    const stream = { isStopped: false, isFinished: true };
    host.stream = stream; host.saving(true);
    const continuing = Promise.withResolvers();
    host.reply = () => continuing.promise;
    const retry = adapter.retry(1);
    await setImmediate();
    assert.equal(adapter.view().phase.kind, 'continuing');
    assert.deepEqual(adapter.view().phase.candidate.records, saved);
    await assert.rejects(adapter.retry(1));
    assert.equal(adapter.view().wait, null);
    assert.equal(host.ids, ids);
    assert.equal(host.requests.length, 2);
    assert.equal(host.stream, stream);
    continuing.resolve(); await retry;
    assert.equal(adapter.view().phase.kind, 'continue-error');
    assert.deepEqual(target.extra.xiaobaiOsDice, saved);
});

for (const partial of [false, true]) {
    test(`failed Dice stream ${partial ? 'with partial output stops the chain without replaying it' : 'can retry using exactly the saved roll'}`, async t => {
        const adapter = setup(t);
        const normalReply = host.reply;
        await begin();
        await host.intercept('normal');
        const target = message(call);
        host.source.chat.push(target);
        host.reply = async () => {
            host.stream = { isStopped: true, isFinished: false };
            // Even a complete new request inside a failed stream is not eligible for another roll.
            if (partial) target.mes += '\n\n' + call;
        };
        await received();
        await settled(adapter);
        const saved = structuredClone(target.extra.xiaobaiOsDice);
        assert.equal(host.requests.length, 1);
        assert.equal(saved.checks.length, 1);
        assert.equal(adapter.view().phase.error, '', 'native stream failures are not repeated in Dice feedback');
        if (partial) {
            assert.equal(target.mes, 'Attempt.\n\n[dice:generated-0]\n\n' + call, 'partial output is never rolled back');
            assert.equal(adapter.view().phase.kind, 'invalid');
            await assert.rejects(adapter.retry(1));
            assert.equal(host.requests.length, 1);
        } else {
            assert.equal(adapter.view().phase.kind, 'continue-error');
            host.reply = normalReply;
            await adapter.retry(1);
            assert.equal(host.requests.length, 2);
            assert.equal(target.mes, 'Attempt.\n\n[dice:generated-0]\n\nAfterward.');
            assert.equal(adapter.view(), null);
        }
        assert.deepEqual(target.extra.xiaobaiOsDice, saved);
    });
}

for (const group of [false, true]) {
    test(`failed optional check preparation leaves ${group ? 'group' : 'single'} replies running without rolling`, async t => {
        const adapter = setup(t, group);
        if (group) host.group(true);
        host.preflight = async () => { throw new Error('internal setup details'); };
        await begin('normal', { signal: new AbortController().signal });
        assert.equal(await host.intercept('normal'), false);
        assert.equal(host.prompts.get('xiaobai_os_dice'), '');
        const target = message(call);
        host.source.chat.push(target);
        await received();
        if (group) await host.emit('GROUP_MEMBER_DRAFTED');
        await settled(adapter);
        assert.equal(host.requests.length, 0, 'no Dice follow-up is dispatched');
        assert.equal(target.mes, call);
        assert.equal(adapter.view().phase.kind, 'invalid');
        assert.ok(adapter.view().phase.error);
        assert.equal(adapter.view().phase.error.includes('internal setup details'), false);
    });
}

test('host rejection keeps silent same-roll recovery while Dice preparation failure stays local', async t => {
    const adapter = setup(t);
    const normalReply = host.reply;
    await begin(); await host.intercept('normal');
    const target = message(call); host.source.chat.push(target);
    host.reply = async () => { throw new Error('provider error already shown by host'); };
    await received(); await settled(adapter);
    const saved = structuredClone(target.extra.xiaobaiOsDice);
    assert.equal(adapter.view().phase.kind, 'continue-error');
    assert.equal(adapter.view().phase.error, '');
    host.preflight = async () => { throw new Error('private implementation failure'); };
    await adapter.retry(1);
    assert.equal(adapter.view().phase.kind, 'continue-error');
    assert.ok(adapter.view().phase.error);
    assert.equal(adapter.view().phase.error.includes('private implementation failure'), false);
    assert.equal(host.requests.length, 1, 'Dice preparation failure must not call the provider without the saved result');
    host.preflight = async () => {}; host.reply = normalReply;
    await adapter.retry(1);
    assert.equal(host.requests.length, 2);
    assert.deepEqual(target.extra.xiaobaiOsDice, saved);
    assert.equal(adapter.view(), null);
});

test('an open native message editor blocks both new checks and same-roll continuation', async t => {
    const adapter = setup(t, false, async () => { host.editing = true; });
    await begin(); await host.intercept('normal');
    const target = message(call); host.source.chat.push(target);
    host.editing = true;
    await received(); await settled(adapter);
    assert.equal(host.requests.length, 0);
    assert.equal(target.mes, call);

    host.editing = false;
    await begin(); await host.intercept('normal');
    await received(); await settled(adapter);
    assert.equal(host.requests.length, 0, 'Dice cannot continue into a message editor');
    const saved = structuredClone(target.extra.xiaobaiOsDice);
    host.editing = false;
    await adapter.retry(1);
    assert.equal(host.requests.length, 1);
    assert.deepEqual(target.extra.xiaobaiOsDice, saved);
});
