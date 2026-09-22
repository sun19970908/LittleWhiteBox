import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { build } from 'esbuild';
import { DICE_RECORDS_SCHEMA_VERSION, parseDiceRecords } from '../apps/dice/domain/check-records.ts';
import { prepareActionCheck } from '../apps/dice/application/prepare-action-check.ts';
import { generateCoc7Sheet } from '../apps/dice/domain/coc7-creation.ts';

// Exercise the real display; only native chat/event access is replaced.
const compiled = await build({
    stdin: { contents: `export { createDiceMessageDisplay } from '../apps/dice/host/message-display.ts'; export { source } from 'dice-display-host';`,
        resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'dice-display-host', setup(builder) {
        builder.onResolve({ filter: /^js-sha256$/ }, () => ({ path: import.meta.resolve('js-sha256'), external: true }));
        builder.onResolve({ filter: /(?:^dice-display-host$|\/(?:script|group-chats|event-manager|sillytavern-port)\.js$)/ }, () => ({ path: 'host', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
            export const source = { chat: [] };
            export const captureDiceChat = () => source;
            export const is_send_press = true;
            export const is_group_generating = false;
            export const updateMessageBlock = () => { throw new Error('Unexpected native repaint'); };
            export const event_types = {};
            export const createModuleEvents = () => ({ on() {}, cleanup() {} });
        ` }));
    } }],
});
// eslint-disable-next-line no-unsanitized/method -- Repository component with isolated native I/O.
const { createDiceMessageDisplay, source } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

function setup(t, runtime, enabled = () => true) {
    const { document, window } = parseHTML('<html><head></head><body><div id="chat"><div class="mes" mesid="0"><div class="mes_text"></div></div></div></body></html>');
    const previous = new Map(), frames = new Map();
    let frameId = 0, display;
    const globals = { document, MutationObserver: window.MutationObserver,
        requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id) };
    for (const [key, value] of Object.entries(globals)) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value, configurable: true });
    }
    t.after(() => { display?.stop(); for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    } });
    const render = () => { const work = [...frames.values()]; frames.clear(); for (const fn of work) fn(); };
    const chat = document.getElementById('chat');
    const content = document.querySelector('.mes_text');
    display = createDiceMessageDisplay({ canRetryRequest: () => false, ...runtime }, enabled);
    content.textContent = source.chat[0].mes;
    display.start(); render();
    return { chat, content, display, render };
}

test('host wait updates in place and its paused request has an actionable, stable retry control', async t => {
    const message = { mes: '<xb_action_check>{"action":"Climb","stat":"Agility","difficulty":"hard"}</xb_action_check>', extra: {} };
    source.chat = [message];
    const target = { message, swipe: 0, index: 0, source };
    let active = { target, phase: { kind: 'settling' }, wait: { blockers: ['generation'], elapsedSeconds: 1 } };
    const retries = [];
    const { content, display, render } = setup(t, { view: () => active, cancel() {}, retry: async index => { retries.push(index); } });
    const pending = content.querySelector('[data-dice-state="waiting"]');
    assert.ok(pending);
    const initial = pending.textContent;
    active.wait = { blockers: ['generation'], elapsedSeconds: 8 };
    display.refresh(); render();
    assert.equal(content.querySelector('[data-dice-state="waiting"]'), pending);
    assert.notEqual(pending.textContent, initial, 'the current wait and its elapsed time must be visible');
    active.phase = { kind: 'wait-error' };
    display.refresh(); render();
    assert.equal(content.querySelector('[data-dice-state="waiting"]'), null);
    assert.equal(content.querySelectorAll('[data-dice-state="wait-error"]').length, 1);
    const button = content.querySelector('[data-dice-action="retry-check"]');
    assert.ok(button);
    display.refresh(); render();
    assert.equal(content.querySelector('[data-dice-action="retry-check"]'), button, 'unrelated repaints keep focus and click ownership');
    button.click(); await Promise.resolve();
    assert.deepEqual(retries, [0]);
    assert.equal(message.extra.xiaobaiOsDice, undefined);
});

test('continuation status ticks through preparation and response, survives whitespace, and ends on actual prose', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const candidate = prepareActionCheck({ body: '<xb_action_check>{"action":"Climb","stat":"Agility","difficulty":"hard"}</xb_action_check>',
        generatedFrom: 0, id: 'progress', random: () => .3 });
    const message = { mes: candidate.body, extra: { xiaobaiOsDice: candidate.records } };
    source.chat = [message];
    const active = { target: { message, swipe: 0, index: 0, source }, phase: { kind: 'continuing', candidate },
        continuation: { stage: 'preparing', elapsedSeconds: 0 } };
    let reads = 0;
    const { content, display, render } = setup(t, { view: () => { reads++; return active; }, cancel() {}, retry: async () => {} });
    const card = content.querySelector('[data-dice-record="progress"]');
    const status = card.querySelector('[role="status"]');
    for (const stage of ['preparing', 'requesting', 'responding']) {
        active.continuation = { stage, elapsedSeconds: 0 };
        display.refresh(); render();
        assert.equal(status.hidden, false);
        assert.equal(status.dataset.diceState, stage);
        active.continuation.elapsedSeconds = 4;
        t.mock.timers.tick(1000); render();
        assert.equal(status.dataset.elapsedSeconds, '4', 'time advances without a message mutation');
        assert.equal(card.querySelector('[role="status"]'), status);
    }
    message.mes = '\n' + candidate.body + '  \n';
    display.refresh(); render();
    assert.equal(status.hidden, false, 'native whitespace changes are not continuation output');
    message.mes += 'The character reaches the top.';
    display.refresh(); render();
    assert.equal(status.hidden, true);
    assert.equal(status.dataset.diceState, undefined);
    assert.equal(status.dataset.elapsedSeconds, undefined);
    const finishedReads = reads;
    t.mock.timers.tick(5000); render();
    assert.equal(reads, finishedReads, 'visible prose ends the status timer');
    message.mes = candidate.body;
    display.refresh(); render();
    display.stop();
    const stoppedReads = reads;
    t.mock.timers.tick(5000); render();
    assert.equal(reads, stoppedReads, 'unmount clears the active timer');
});

test('an unrolled restored request offers manual recovery without triggering it on render', async t => {
    source.chat = [{ mes: 'Unrolled request', extra: {} }];
    const retries = [];
    const { content, display, render } = setup(t, { view: () => null, cancel() {}, canRetryRequest: index => index === 0,
        retry: async index => { retries.push(index); } });
    display.refresh(); render();
    assert.deepEqual(retries, []);
    assert.equal(content.querySelectorAll('[data-dice-state="unrolled"]').length, 1);
    content.querySelector('[data-dice-action="retry-check"]').click(); await Promise.resolve();
    assert.deepEqual(retries, [0]);
});

test('card redraws leave scrolling to the host, even when a temporary layout appears at the bottom', t => {
    const record = { rule: 'd20', id: 'one', request: { character: 'Test', action: 'Climb', stat: 'Ability', difficulty: 'hard' },
        dc: 12, roll: 14, outcome: 'success' };
    const records = { schemaVersion: DICE_RECORDS_SCHEMA_VERSION, checks: [record] };
    const message = { mes: 'Before [dice:one]', extra: { xiaobaiOsDice: records }, swipe_id: 0 };
    source.chat = [message];
    const target = { message, swipe: 0, index: 0, source };
    const candidate = { body: message.mes, records };
    let active = { target, phase: { kind: 'continuing', candidate } };
    const { chat, content, display, render } = setup(t, { view: () => active, cancel() {}, retry: async () => {} });
    const writes = [];
    let scrollTop = 500;
    // This checks scroll ownership, not browser layout/anchoring (covered in browser verification).
    Object.defineProperties(chat, {
        scrollHeight: { get: () => 1000 }, clientHeight: { get: () => 500 },
        scrollTop: { get: () => scrollTop, set: value => { writes.push(value); scrollTop = value; } },
    });
    const card = content.querySelector('[data-dice-record="one"]');
    assert.ok(card);
    for (const gap of [0, 10, 80, 400]) {
        for (const kind of ['revealing', 'continuing', 'continue-error', null]) {
            scrollTop = 500 - gap;
            active = kind ? { target, phase: { kind, candidate, error: kind === 'continue-error' ? 'Retry' : '' } } : null;
            content.textContent = message.mes;
            display.refresh(); render();
            assert.equal(content.querySelector('[data-dice-record="one"]'), card, 'stream repaint reuses the same card');
            assert.equal(scrollTop, 500 - gap);
            assert.deepEqual(writes, [], 'repaint must not override the host scroll lock');
        }
    }
    display.refresh(); display.stop(); render();
    assert.equal(content.textContent, message.mes, 'stopping restores the marker');
    assert.deepEqual(writes, []);
});

test('reloaded CoC history mounts with checks disabled and keeps its recorded verdict', t => {
    const request = { action: 'Break past the guard', stat: 'melee', difficulty: 'hard' };
    const prepared = prepareActionCheck({ body: `<xb_action_check>${JSON.stringify(request)}</xb_action_check>`, rule: 'coc7',
        generatedFrom: 0, id: 'coc', coc7Sheet: generateCoc7Sheet(() => 0.5), random: () => 0.1 });
    source.chat = JSON.parse(JSON.stringify([{ mes: prepared.body + '\nNext sentence.', extra: { xiaobaiOsDice: prepared.records } }]));
    const { content } = setup(t, { view: () => null, cancel() {}, retry: () => assert.fail('historical cards do not resume') }, () => false);
    const card = content.querySelector('[data-dice-record="coc"]');
    assert.ok(card);
    assert.equal(card.dataset.rule, 'coc7');
    assert.equal(card.dataset.verdict, prepared.records.checks[0].result.verdict);
    assert.equal(Number(card.querySelector('[data-roll]').dataset.roll), prepared.records.checks[0].result.roll);
    assert.equal(card.querySelector('button'), null);
    assert.equal(card.querySelector('[data-result]').hidden, false);
});

test('cards, continuation status and recovery follow retained markers, not their old positions or stored order', async t => {
    const message = JSON.parse(readFileSync(new URL('./fixtures/dice-message-a32c28d0.json', import.meta.url), 'utf8'));
    source.chat = [message];
    const raw = structuredClone(message.extra.xiaobaiOsDice);
    let active = null;
    const retries = [];
    const { content, display, render } = setup(t, { view: () => active,
        cancel() {}, retry: async index => { retries.push(index); } });
    const wall = content.querySelector('[data-dice-record="wall"]');
    const door = content.querySelector('[data-dice-record="door"]');
    for (const [body, ids, recovery] of [
        ['Rewritten. [dice:wall] New transition. [dice:door]', ['wall', 'door'], 'door'],
        ['Reordered. [dice:door] Moved. [dice:wall]', ['door', 'wall'], 'wall'],
        ['Removed door. [dice:wall]', ['wall'], 'wall'],
        ['[dice:wall] User already continued.', ['wall'], null],
        ['No references.', [], null],
        ['Restored. [dice:wall]', ['wall'], 'wall'],
    ]) {
        message.mes = body; content.textContent = body;
        display.refresh(); render();
        assert.deepEqual([...content.querySelectorAll('[data-dice-record]')].map(node => node.dataset.diceRecord), ids);
        assert.deepEqual([...content.querySelectorAll('button')].map(node => node.closest('[data-dice-record]').dataset.diceRecord), recovery ? [recovery] : []);
        if (ids.length === 2) {
            assert.equal(content.querySelector('[data-dice-record="wall"]'), wall);
            assert.equal(content.querySelector('[data-dice-record="door"]'), door);
        }
    }
    content.querySelector('button').click(); await Promise.resolve();
    assert.deepEqual(retries, [0]);
    const candidate = { body: message.mes, records: parseDiceRecords(raw) };
    const target = { message, swipe: 0, index: 0, source };
    for (const kind of ['continuing', 'continue-error']) {
        active = { target, phase: { kind, candidate, error: '' } };
        display.refresh(); render();
        const card = content.querySelector('[data-dice-record="wall"]');
        assert.equal(card.querySelector('.xb-dice-status').hidden, false);
        assert.equal(!!card.querySelector('button'), kind === 'continue-error');
        assert.equal(content.querySelector('[data-dice-record="door"]'), null);
    }
    assert.deepEqual(message.extra.xiaobaiOsDice, raw);
});

test('a serialized current message renders the same static card on reload with new checks disabled', t => {
    const candidate = prepareActionCheck({ body: 'Attempt.\n\n<xb_action_check>{"action":"Climb","stat":"Agility","difficulty":"hard"}</xb_action_check>',
        generatedFrom: 0, id: 'reloaded', random: () => .3 });
    const message = JSON.parse(JSON.stringify({ mes: candidate.body + '\nAfterward.', extra: { xiaobaiOsDice: candidate.records } }));
    source.chat = [message];
    const before = structuredClone(message);
    t.mock.method(Math, 'random', () => assert.fail('display must never reroll'));
    const { content, display, render } = setup(t, { view: () => null, cancel() {},
        retry: async () => assert.fail('display must never start generation') }, () => false);
    for (let repaint = 0; repaint < 2; repaint++) {
        content.textContent = message.mes; display.refresh(); render();
        const card = content.querySelector('[data-dice-record="reloaded"]');
        assert.ok(card);
        assert.equal(card.dataset.state, 'settled');
        assert.equal(card.dataset.outcome, candidate.records.checks[0].outcome);
        assert.deepEqual([...card.querySelectorAll('.xb-dice-score-value')].map(node => Number(node.textContent)),
            [candidate.records.checks[0].roll, candidate.records.checks[0].dc]);
        assert.equal(card.querySelector('button'), null);
    }
    assert.deepEqual(message, before);
});
