import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import { parseHTML } from 'linkedom';
import { compileDefinition } from '../definition/compile.js';
import { initialize, settle } from '../engine/settle.js';
import { createGuideFixture } from './guide-fixture.js';
import { accepted } from './fixture.js';
import type { Bundle, JsonObject } from '../types.js';

const examples = new URL('../skill/references/examples/camp/', import.meta.url);
const bundle: Bundle = { definition: JSON.parse(readFileSync(new URL('definition.json', examples), 'utf8')), functions: {} };
const html = readFileSync(new URL('panel.html.txt', examples), 'utf8');

async function panel() {
    const fixture = await createGuideFixture(structuredClone(bundle));
    const { document } = parseHTML(html), lifecycle = new EventEmitter(), timers = new Map<number, () => void>();
    runInNewContext(document.querySelector('script')!.textContent!, {
        document,
        window: {
            parent: fixture.host,
            setInterval: (callback: () => void) => { timers.set(1, callback); return 1; },
            clearInterval: (id: number) => timers.delete(id),
            addEventListener: (event: string, callback: () => void) => lifecycle.once(event, callback),
        },
    });
    const element = (id: string) => document.getElementById(id)!;
    return { ...fixture, document, timers, element,
        tick: () => timers.get(1)?.(), close: () => lifecycle.emit('pagehide'),
        click: (id: string) => (element(id) as HTMLButtonElement).click(),
        pending: () => (element('rest') as HTMLButtonElement).disabled,
    };
}
async function until(predicate: () => boolean) {
    for (let turn = 0; turn < 100; turn++) {
        if (predicate()) {return;}
        await new Promise<void>(resolve => setImmediate(resolve));
    }
    assert.ok(predicate(), 'example did not finish its pending interaction');
}

// Acceptance: published definition and input examples must execute against the
// real engine; invalid batches must leave their input untouched (silent state corruption).
test('guide definition and documented dynamic-member batch are executable', async () => {
    const compiled = compileDefinition(bundle), start = accepted(await initialize(compiled)).state;
    const unchanged = structuredClone(start);
    const guide = readFileSync(new URL('../skill/references/state-design.md', import.meta.url), 'utf8');
    for (const [, body] of guide.matchAll(/```json\r?\n([\s\S]*?)```/g)) {
        const input = JSON.parse(body);
        if (!Array.isArray(input)) {
            // This guide also teaches opening data fragments; execute those as
            // starts, not as the dynamic-member operation batch below.
            const openingBundle: Bundle = { definition: { ...bundle.definition, ...input,
                schema: {}, rules: [], actions: [], access: [], views: {}, constraints: [] }, functions: {} };
            const openingRules = compileDefinition(openingBundle);
            assert.deepEqual(accepted(await initialize(openingRules)).state, { hero: { place: '营地', coins: 30, items: ['背包'] } });
            assert.deepEqual(accepted(await initialize(openingRules, { opening: 1 })).state, { hero: { place: '港口', coins: 80, items: ['船票'] } });
            continue;
        }
        const result = accepted(await settle(compiled, start, input));
        assert.ok(result.changes.length);
        assert.deepEqual(start, unchanged);
        const rejected = await settle(compiled, start, [input[1]]);
        assert.equal(rejected.ok, false, 'missing parent is not silently created');
        assert.deepEqual(start, unchanged);
    }
    const rest = [{ action: 'rest', params: {} }];
    const host = await createGuideFixture(bundle), initial = host.state();
    assert.ok(accepted(await host.host.LWB_StateV3.apply(rest)).changes.length);
    accepted(await host.undo());
    assert.deepEqual(host.state(), initial, 'undo restores the published example state');
});

// Acceptance: displaying state must never submit it, and an open panel must
// follow outside writes/restoration, including missing→same value (silent stale display).
test('guide panel only reads on mount and recovers after external changes, missing roots and read errors', async () => {
    const p = await panel();
    try {
        const initial = p.state(), first = p.element('state').textContent;
        p.tick(); p.tick();
        assert.equal(p.controls.applyCalls, 0);
        const result = accepted(await p.service.apply([{ action: 'rest', params: {} }]));
        p.tick();
        const changed = p.element('state').textContent;
        assert.notEqual(changed, first);
        p.external({}); p.tick();
        assert.notEqual(p.element('state').textContent, changed);
        assert.ok(p.pending());
        p.external(result.state); p.tick();
        assert.equal(p.element('state').textContent, changed);
        p.controls.readError = true; p.tick();
        assert.ok(p.pending());
        p.controls.readError = false; p.tick();
        assert.equal(p.element('state').textContent, changed);
        await p.undo(); p.tick();
        assert.deepEqual(p.state(), initial);
        assert.equal(p.element('state').textContent, first);
        p.controls.chatId = 'guide-b'; p.tick(); p.click('rest');
        assert.equal(p.controls.applyCalls, 0, 'old panel cannot submit in a different chat');
        assert.ok(p.pending());
    } finally { p.close(); }
    assert.equal(p.timers.size, 0);
});

// Acceptance: one pending click submits once; cap/no-op uses actual changes,
// rejection is atomic, and save-only retry never repeats gameplay (duplicate spending/rewards).
test('guide panel handles pending, rejected, corrected, no-change and unsaved results without replay', async () => {
    const p = await panel();
    try {
        const release = p.holdSave();
        p.click('rest'); p.tick(); p.click('rest');
        assert.equal(p.controls.applyCalls, 1);
        assert.ok(p.pending(), 'polling cannot release a pending operation');
        release(); await until(() => !p.pending());
        for (let count = 0; count < 2; count++) { p.click('rest'); await until(() => !p.pending()); }
        const result = p.host.LWB_StateV3.lastResult();
        assert.ok(result?.ok && result.saved);
        assert.deepEqual(result.changes, [], 'no-change feedback is based on the engine result');

        const invalid = p.state() as JsonObject;
        (invalid.camp as JsonObject).unexpected = true;
        p.external(invalid); p.tick();
        const records = p.records(); p.click('rest'); await until(() => !p.pending());
        assert.equal(p.host.LWB_StateV3.lastResult()?.ok, false);
        assert.deepEqual(p.records(), records);
        assert.deepEqual(p.state(), invalid);
        assert.equal(p.element('details').hidden, false);

        p.external(accepted(await initialize(compileDefinition(bundle))).state); p.tick();
        p.controls.offline = true;
        p.click('rest'); await until(() => !p.pending());
        const unsaved = p.host.LWB_StateV3.lastResult();
        assert.ok(unsaved?.ok && unsaved.committed && !unsaved.saved);
        assert.equal(p.element('retry').hidden, false);
        const committed = p.state(), entries = p.records(), calls = p.controls.applyCalls;
        p.click('retry'); await until(() => !p.pending());
        assert.equal(p.element('retry').hidden, false, 'failed save-only retry remains available');
        p.controls.offline = false;
        p.click('retry'); await until(() => !p.pending());
        assert.equal(p.controls.applyCalls, calls);
        assert.deepEqual(p.state(), committed);
        assert.deepEqual(p.records(), entries);
        assert.equal(p.element('retry').hidden, true);
        p.reopen(); p.tick(); assert.deepEqual(p.state(), committed);

        p.controls.unavailable = true;
        p.click('rest'); await until(() => !p.pending());
        assert.equal(p.element('details').hidden, false, 'synchronous API errors are visible');
        assert.deepEqual(p.state(), committed);
    } finally { p.close(); }
    const calls = p.controls.applyCalls;
    p.click('rest'); assert.equal(p.controls.applyCalls, calls);
    assert.equal(p.timers.size, 0);
});
