import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { CONTEXT_COPY } from './context-copy.js';
import { exposeUpdateRules, UPDATE_RULES_PREFIX } from '../updater/world-info.js';
import type { CaptureContext, captureContext } from './context-capture.js';

// Protocol/data isolation: native token counting must neither interrupt the
// updater nor read its temporary prompt layout. Real generation still cancels it.
function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}
function fixture(before = false) {
    type Prompt = { identifier?: string; name?: string; role?: string; content: string };
    type Listener = (...args: unknown[]) => unknown;
    const listeners = new Map<string, Set<Listener>>();
    const emit = async (key: string, ...args: unknown[]) => { for (const listener of [...listeners.get(key) || []]) {await listener(...args);} };
    const events = Object.fromEntries(['GENERATION_STARTED', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_CHANGED', 'WORLDINFO_ENTRIES_LOADED'].map(key => [key, key]));
    const target = { floor: before ? 2 : 0, swipeId: 0, message: { name: before ? 'Player' : 'Alice', is_user: before } };
    const chat = [target.message], layouts: string[] = [];
    const entered = deferred(), hold = deferred();
    let holdType = 'quiet';
    let failure = false;
    const savedLore = {
        globalLore: [{ comment: UPDATE_RULES_PREFIX + 'Global', disable: true, content: 'global-rule', constant: true }],
        characterLore: [
            { comment: UPDATE_RULES_PREFIX + 'Character', disable: true, content: 'character-rule', constant: true, position: 4, depth: 0 },
            { comment: 'State', disable: false, content: 'current-state', constant: true },
            { comment: 'Unrelated', disable: true, content: 'hidden-lore', constant: true },
            { comment: 'Not a prefix ' + UPDATE_RULES_PREFIX, disable: true, content: 'suffix-lore', constant: true },
            { comment: UPDATE_RULES_PREFIX + 'Enabled', disable: false, content: 'enabled-rule', constant: true },
        ],
        chatLore: [{ comment: UPDATE_RULES_PREFIX + 'Chat', disable: true, content: 'chat-rule', constant: true }],
        personaLore: [{ comment: UPDATE_RULES_PREFIX + 'Persona', disable: true, content: 'persona-rule', constant: true }],
    };
    // Deliberately retain the entry references to catch mutation of saved data.
    async function readLore() {
        const lore = Object.fromEntries(Object.entries(savedLore).map(([key, entries]) => [key, [...entries]]));
        await emit(events.WORLDINFO_ENTRIES_LOADED, lore);
        return Object.values(lore).flat().filter(entry => !entry.disable);
    }
    const manager = {
        getPromptCollection: (_type: string): Prompt[] => [{ identifier: 'main', content: 'native-preset' }],
        preparePrompt: (prompt: Prompt) => ({ ...prompt }),
        isPromptDisabledForActiveCharacter: () => false,
        setChatCompletion() {},
        tryGenerate: () => generate('normal', {}),
    };
    async function generate(type: string, options: { signal?: AbortSignal }) {
        await emit(events.GENERATION_STARTED, type, options, true);
        if (type === holdType) { entered.resolve(); await hold.promise; }
        if (failure) {throw new Error('fixture capture failed');}
        const collection = manager.getPromptCollection(type);
        layouts.push(collection[0].content);
        const passages = before ? [
            { identifier: 'chatHistory-3', name: 'Alice', role: 'assistant', content: 'Later prose, not input to this action.' },
            { identifier: 'chatHistory-2', name: 'Player', role: 'user', content: 'Buy a potion.' },
            { identifier: 'chatHistory-1', name: 'Alice', role: 'assistant', content: 'The shop is open.' },
            { identifier: 'chatHistory-0', name: 'Player', role: 'user', content: 'Visit the shop.' },
        ].map(prompt => manager.preparePrompt(prompt)).reverse()
            : [manager.preparePrompt({ identifier: 'chatHistory-0', name: 'Alice', role: 'assistant', content: 'Bought a potion.' })];
        const lore = await readLore();
        await emit(events.CHAT_COMPLETION_PROMPT_READY, { dryRun: true, chat: [{ role: 'system', content: collection[0].content }, ...passages,
            ...lore.map(entry => ({ role: 'system', content: entry.content }))] });
    }
    const ctx = { chat, characterId: 0, eventTypes: events, eventSource: {
        on(key: string, listener: Listener) { if (!listeners.has(key)) {listeners.set(key, new Set());} listeners.get(key)!.add(listener); },
        removeListener(key: string, listener: Listener) { listeners.get(key)?.delete(listener); },
    } } as CaptureContext;
    const source = readFileSync('modules/variables/shared/context-capture.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const sandbox = { Generate: generate, main_api: 'openai', chat, name2: 'Alice', isGenerating: () => false,
        promptManager: manager, PromptCollection: class extends Array<Prompt> {}, IGNORE_SYMBOL: Symbol('ignore'),
        COPY: CONTEXT_COPY, AbortController, structuredClone, Promise,
    };
    const api = runInNewContext(code + '\n({ captureContext, init: initContextCapture, cleanup: cleanupContextCapture })', sandbox) as {
        captureContext: typeof captureContext; init(): void; cleanup(): void;
    };
    const nativePreview = manager.tryGenerate;
    api.init();
    return { ...api, entered, hold, layouts, manager, ctx, emit, events, nativePreview, savedLore, readLore,
        fail() { failure = true; },
        ruleListeners: () => listeners.get(events.WORLDINFO_ENTRIES_LOADED)?.size || 0,
        holdNative() { holdType = 'normal'; },
        capture: (signal?: AbortSignal, rules = false) => api.captureContext(ctx, target, {}, text => text, signal,
            rules ? () => exposeUpdateRules(ctx) : undefined),
    };
}

// B7: recomputing a USER action must not consume its later AI reply as new
// evidence, nor mark an older USER as the target (duplicate or wrong settlement).
test('B7: before context marks the latest USER and excludes later prose', async () => {
    const f = fixture(true);
    try {
        f.hold.resolve();
        const result = await f.capture();
        const messages = result.messages.filter(message => ['user', 'assistant'].includes(message.role));
        assert.deepEqual(JSON.parse(JSON.stringify(messages.map(({ role, content }) => ({ role, content })))), [
            { role: 'user', content: 'Visit the shop.' },
            { role: 'assistant', content: 'The shop is open.' },
            { role: 'user', content: '<variable-update-target>\nBuy a potion.\n</variable-update-target>' },
        ]);
    } finally { f.cleanup(); }
});

test('native token preview arriving during variable capture waits and uses the native preset', async () => {
    const f = fixture();
    try {
        const capture = f.capture(); await f.entered.promise;
        const preview = f.manager.tryGenerate();
        f.hold.resolve();
        const result = await capture; await preview;
        assert.ok(JSON.stringify(result.messages).includes('Bought a potion.'));
        assert.equal(f.layouts.at(-1), 'native-preset');
    } finally { f.hold.resolve(); f.cleanup(); }
});

test('variable capture waits for an already running native token preview', async () => {
    const f = fixture(); f.holdNative();
    try {
        const preview = f.manager.tryGenerate(); await f.entered.promise;
        const capture = f.capture(); f.hold.resolve();
        await preview; await capture;
        assert.equal(f.layouts[0], 'native-preset');
        assert.equal(f.layouts.length, 2);
    } finally { f.hold.resolve(); f.cleanup(); }
});

test('a real generation still interrupts capture, releases the preview and restores the prompt manager', async () => {
    const f = fixture();
    try {
        const capture = f.capture(); await f.entered.promise;
        const rejected = assert.rejects(capture);
        const preview = f.manager.tryGenerate();
        await f.emit(f.events.GENERATION_STARTED, 'normal', {}, false);
        f.hold.resolve(); await rejected; await preview;
        assert.equal(f.layouts.at(-1), 'native-preset');
        assert.equal(f.manager.getPromptCollection('quiet')[0].content, 'native-preset');
    } finally { f.hold.resolve(); f.cleanup(); }
});

test('cancelling a queued capture skips it without blocking the native preview or changing its layout', async () => {
    const f = fixture(); f.holdNative();
    try {
        const preview = f.manager.tryGenerate(); await f.entered.promise;
        const controller = new AbortController(), capture = f.capture(controller.signal);
        const rejected = assert.rejects(capture);
        controller.abort(); f.hold.resolve();
        await rejected; await preview;
        assert.deepEqual(f.layouts, ['native-preset']);
    } finally { f.hold.resolve(); f.cleanup(); }
    assert.equal(f.manager.tryGenerate, f.nativePreview);
});

// U1/U2: the same capture supports both consumers without leaking update rules
// into ordinary RP, 3.0, native previews, or saved worldbook data.
test('only an opted-in capture includes disabled update-rule entries and preserves their source objects', async () => {
    const f = fixture(), before = structuredClone(f.savedLore);
    try {
        f.hold.resolve();
        for (const rules of [false, true, false, true]) {
            const result = await f.capture(undefined, rules);
            const contents = result.messages.map(message => message.content);
            for (const content of ['global-rule', 'character-rule', 'chat-rule', 'persona-rule']) {
                assert.equal(contents.includes(content), rules);
            }
            assert.equal(contents.filter(content => content === 'enabled-rule').length, 1);
            assert.ok(contents.includes('current-state'));
            assert.ok(!contents.includes('hidden-lore') && !contents.includes('suffix-lore'));
            assert.deepEqual(f.savedLore, before);
            assert.equal(f.ruleListeners(), 0);
            assert.deepEqual((await f.readLore()).map(entry => entry.content), ['current-state', 'enabled-rule']);
        }
    } finally { f.hold.resolve(); f.cleanup(); }
});

// U3: cleanup is observable before a replacement generation can read worldbooks.
test('rule projection is removed on abort, chat change, another generation and capture failure', async () => {
    for (const outcome of ['abort', 'chat', 'generation', 'failure']) {
        const f = fixture(), controller = new AbortController(), before = structuredClone(f.savedLore);
        try {
            const capture = f.capture(controller.signal, true); await f.entered.promise;
            const rejected = assert.rejects(capture);
            assert.equal(f.ruleListeners(), 1);
            if (outcome === 'abort') {controller.abort();}
            else if (outcome === 'chat') {await f.emit(f.events.CHAT_CHANGED);}
            else if (outcome === 'generation') {await f.emit(f.events.GENERATION_STARTED, 'quiet', {}, true);}
            else {f.fail();}
            if (outcome !== 'failure') {
                assert.equal(f.ruleListeners(), 0);
                assert.deepEqual((await f.readLore()).map(entry => entry.content), ['current-state', 'enabled-rule']);
            }
            f.hold.resolve(); await rejected;
            assert.equal(f.ruleListeners(), 0);
            assert.deepEqual(f.savedLore, before);
        } finally { f.hold.resolve(); f.cleanup(); }
    }
});

test('a queued update capture installs no lore listener before its turn and skips cancelled work', async () => {
    const f = fixture(); f.holdNative();
    try {
        const preview = f.manager.tryGenerate(); await f.entered.promise;
        const controller = new AbortController(), capture = f.capture(controller.signal, true);
        const rejected = assert.rejects(capture);
        assert.equal(f.ruleListeners(), 0);
        controller.abort(); f.hold.resolve(); await preview; await rejected;
        assert.equal(f.ruleListeners(), 0);
        assert.deepEqual((await f.readLore()).map(entry => entry.content), ['current-state', 'enabled-rule']);
    } finally { f.hold.resolve(); f.cleanup(); }
});
