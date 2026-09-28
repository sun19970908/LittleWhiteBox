import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createPromptInjectionRegistry } from '../capabilities/prompt-injection/registry.ts';
import { createPromptInjectionCapabilityRegistration } from '../capabilities/prompt-injection/index.ts';
import { createPromptInjectionRuntime } from '../host/prompt-injection-runtime.ts';
import { PROMPT_INJECTION_POLICY } from '../host/prompt-injection-policy.ts';
import { DICE_CHECK_PROMPTS, DICE_ENCOUNTER_PROMPTS } from '../apps/dice/prompt-registration.ts';
import { TASK_PROMPTS } from '../apps/tasks/prompt-registration.ts';
import { SHOP_PROMPTS } from '../apps/shop/prompt-registration.ts';
import { MAP_PROMPTS } from '../apps/map/prompt-registration.ts';
import { WORLD_PROMPTS } from '../apps/world/prompt-registration.ts';

class Prompt { constructor(value) { Object.assign(this, value); } }
class Collection {
    collection = [];
    add(...items) {
        assert.ok(items.every(item => item instanceof Prompt));
        this.collection.push(...items);
    }
}

test('a failed host attachment releases its registrations and native resources before installation fails', () => {
    const failure = new Error('attachment failed');
    let handle, attached = false;
    const published = new Map();
    const registration = createPromptInjectionCapabilityRegistration(PROMPT_INJECTION_POLICY, () => ({
        publish(entry) { if (entry.content) published.set(entry.identifier, entry); else published.delete(entry.identifier); },
        start(registry) {
            attached = true;
            handle = registry.register(DICE_CHECK_PROMPTS);
            handle.set('rules', 'rules');
            throw failure;
        },
        stop() { attached = false; },
    }));
    assert.throws(() => registration.install(), error => error === failure);
    assert.equal(attached, false);
    assert.equal(published.size, 0);
    assert.throws(() => handle.set('rules', 'late'));
});

function fixture(t) {
    const state = { identity: 'chat-a', chatCompletion: true, text: new Map(), preset: [] };
    const manager = {
        activeCharacter: { id: 1 }, serviceSettings: { prompts: [], prompt_order: [] },
        getPromptCollection() { const collection = new Collection(); collection.add(...state.preset); return collection; },
        preparePrompt: entry => new Prompt(entry),
    };
    const original = manager.getPromptCollection;
    const runtime = createPromptInjectionRuntime({ manager, absolutePosition: 1,
        isChatCompletion: () => state.chatCompletion, identity: () => state.identity,
        publishText(entry) { if (!state.chatCompletion && entry.content) state.text.set(entry.identifier, entry); else state.text.delete(entry.identifier); },
        clearText: () => state.text.clear(),
    });
    const registry = createPromptInjectionRegistry(PROMPT_INJECTION_POLICY, runtime.publish);
    runtime.start(registry);
    t.after(() => { registry.dispose(); runtime.stop(); });
    function begin(type = 'normal') {
        const controller = new AbortController();
        const run = { signal: controller.signal };
        runtime.begin(type, run);
        return { run, abort: () => controller.abort(), ready: () => runtime.ready(run) };
    }
    return { state, manager, original, runtime, registry, begin,
        collect: (type = 'normal') => manager.getPromptCollection(type).collection };
}

test('all seven production slots receive stable purpose order regardless of activation order', t => {
    const f = fixture(t);
    const request = f.begin();
    const handles = new Map();
    for (const group of [...PROMPT_INJECTION_POLICY].reverse()) {
        const handle = f.registry.register(group);
        handles.set(group, handle);
        for (const slot of Object.keys(group.slots)) handle.set(slot, `${group.id}:${slot}`);
    }
    request.ready();
    const entries = f.collect();
    assert.equal(entries.length, 7);
    const expected = [
        [DICE_CHECK_PROMPTS, 'rules', 1, 'user', 999], [DICE_CHECK_PROMPTS, 'result', 0, 'user', 999],
        [TASK_PROMPTS, 'context', 2, 'system', 998], [SHOP_PROMPTS, 'effects', 1, 'system', 997],
        [DICE_ENCOUNTER_PROMPTS, 'context', 1, 'system', 996], [MAP_PROMPTS, 'context', 3, 'system', 995],
        [WORLD_PROMPTS, 'context', 4, 'system', 994],
    ];
    for (const [group, slot, depth, role, order] of expected) {
        const entry = entries.find(item => item.content === `${group.id}:${slot}`);
        assert.deepEqual([entry.injection_position, entry.injection_depth, entry.role, entry.injection_order], [1, depth, role, order]);
    }
    handles.get(TASK_PROMPTS).dispose();
    assert.equal(f.collect().find(item => item.content === 'shop:effects').injection_order, 997);
    assert.deepEqual(f.state.text.size, 0, 'chat completion has no duplicate extension sink');
});

test('registration owns only its slots; old handles cannot overwrite a replacement', t => {
    const f = fixture(t);
    const old = f.registry.register(DICE_CHECK_PROMPTS);
    assert.throws(() => f.registry.register(DICE_CHECK_PROMPTS));
    assert.throws(() => f.registry.register({ id: 'unregistered', slots: {} }));
    old.set('rules', 'first');
    old.dispose();
    const next = f.registry.register(DICE_CHECK_PROMPTS);
    next.set('rules', 'second');
    old.set('rules', '');
    old.dispose();
    assert.throws(() => old.set('rules', 'stale'));
    assert.deepEqual(f.registry.snapshot().map(entry => entry.content), ['second']);
});

test('only the completed main interception owns injection; previews are repeatable and preset state is untouched', t => {
    const f = fixture(t);
    const prompts = f.registry.register(DICE_CHECK_PROMPTS);
    const preset = new Prompt({ identifier: 'foreign', content: 'preset' });
    f.state.preset.push(preset);
    const before = structuredClone(f.manager.serviceSettings);
    const request = f.begin();
    prompts.set('rules', 'dice');
    assert.deepEqual(f.collect(), [preset]);
    request.ready();
    assert.equal(f.collect().length, 2);
    assert.equal(f.collect().length, 2, 'a count preview cannot consume the real request');
    assert.deepEqual(f.collect('quiet'), [preset]);
    assert.deepEqual(f.collect('impersonate'), [preset]);
    const settings = f.manager.serviceSettings;
    f.manager.serviceSettings = { prompts: [], prompt_order: [] };
    assert.deepEqual(f.collect(), [preset], 'an auxiliary native assembly owns its own preset');
    f.manager.serviceSettings = settings;
    assert.equal(f.collect().length, 2);
    f.state.identity = 'chat-b';
    assert.deepEqual(f.collect(), [preset]);
    f.state.identity = 'chat-a';
    request.abort();
    assert.deepEqual(f.collect(), [preset]);
    assert.deepEqual(f.manager.serviceSettings, before);
    assert.equal(f.state.preset[0], preset);
});

test('clear, replacement, abort and disposal cannot leak prior content or remove another wrapper', t => {
    const f = fixture(t);
    const prompts = f.registry.register(DICE_CHECK_PROMPTS);
    const old = f.begin();
    prompts.set('result', 'old'); old.ready();
    const next = f.begin('continue');
    old.ready();
    assert.equal(f.collect('continue').length, 0);
    prompts.set('result', 'new'); next.ready();
    assert.equal(f.collect('continue').length, 1);
    f.runtime.clear();
    assert.equal(f.registry.snapshot().length, 0);
    const aborted = f.begin(); prompts.set('rules', 'aborted'); aborted.abort(); aborted.ready();
    assert.equal(f.registry.snapshot().length, 0);
    const owned = f.manager.getPromptCollection;
    function later(type) { return owned.call(this, type); }
    f.manager.getPromptCollection = later;
    f.runtime.stop();
    assert.equal(f.manager.getPromptCollection, later);
    assert.equal(f.collect().length, 0);
});

test('text completion keeps depth/role in its native sink and does not enter the collection adapter', t => {
    const f = fixture(t);
    f.state.chatCompletion = false;
    const request = f.begin();
    const prompts = f.registry.register(DICE_CHECK_PROMPTS);
    prompts.set('rules', 'rules'); prompts.set('result', 'result');
    f.registry.register(TASK_PROMPTS).set('context', 'tasks'); request.ready();
    assert.deepEqual([...f.state.text.values()].map(entry => [entry.depth, entry.role]), [[1, 'user'], [0, 'user'], [2, 'system']]);
    assert.equal(f.collect().length, 0);
    f.runtime.stop();
    assert.equal(f.state.text.size, 0);
    assert.equal(f.manager.getPromptCollection, f.original);
});

// Execute frozen native functions, with deterministic token costs instead of a
// tokenizer/model. This tests ST's actual cutoff, not a second sorting algorithm.
function native(version, manager) {
    class Message {
        constructor(role, content, identifier) { Object.assign(this, { role, content, identifier }); }
        static async createAsync(...args) { return new Message(...args); }
        static async fromPromptAsync(prompt) { return new Message(prompt.role, prompt.content, prompt.identifier); }
        getTokens() { return this.content?.length ?? 0; }
    }
    class MessageCollection { constructor(identifier) { this.identifier = identifier; this.collection = []; } }
    const context = createContext({
        Prompt, Message, MessageCollection, promptManager: manager,
        extension_prompt_roles: { SYSTEM: 0, USER: 1, ASSISTANT: 2 }, extension_prompt_types: { IN_CHAT: 1 },
        getExtensionPromptMaxDepth: () => 4,
        getExtensionPrompt: async (_position, depth, _separator, role) => depth === 1 && role === 0 ? 'wi' : '',
        selected_group: null, oai_settings: { new_chat_prompt: '', send_if_empty: '', chat_completion_source: '' },
        substituteParams: value => value,
        isImageInliningSupported: () => false, isVideoInliningSupported: () => false, isAudioInliningSupported: () => false,
        ToolManager: { isToolCallingSupported: () => false }, isReasoningSignatureSupported: () => false,
        interleaved_reasoning_providers: [], tool_reasoning_modes: { DISABLED: 'disabled' },
        character_names_behavior: { COMPLETION: 1 },
    });
    runInContext(readFileSync(new URL(`fixtures/sillytavern-${version}-prompt-functions.js`, import.meta.url), 'utf8'), context);
    return {
        inject: (prompts, messages) => context.populationInjectionPrompts(prompts, structuredClone(messages)),
        async budget(messages, remaining) {
            const chat = [];
            const completion = {
                add() {}, reserveBudget: message => { remaining -= message.getTokens(); },
                freeBudget: message => { remaining += message.getTokens(); },
                canAfford: message => remaining >= message.getTokens(),
                insertAtStart(message) { remaining -= message.getTokens(); if (message.content) chat.unshift(message); },
            };
            await context.populateChatHistory(messages, { has: id => id === 'chatHistory', index: () => 0 }, completion);
            return chat.map(({ role, content }) => ({ role, content }));
        },
    };
}

for (const version of ['1.14', '1.18']) {
    test(`ST ${version}: native ordering preserves foreign prompts, D2 tasks, D1 rules and D0 results`, async t => {
        const f = fixture(t);
        const request = f.begin();
        for (const group of PROMPT_INJECTION_POLICY) {
            const handle = f.registry.register(group);
            for (const slot of Object.keys(group.slots)) handle.set(slot, `${group.id}:${slot}`);
        }
        const preset = new Prompt({ role: 'system', content: 'preset1000', injection_depth: 1, injection_order: 1000 });
        f.state.preset.push(preset);
        request.ready();
        const host = native(version, f.manager);
        const messages = await host.inject(f.collect(), [{ role: 'user', content: 'input' }, { role: 'assistant', content: 'previous' }]);
        const projection = Array.from(messages, ({ role, content }) => [role, content]);
        assert.deepEqual(projection, [
            ['system', 'world:context'], ['system', 'map:context'], ['system', 'tasks:context'], ['assistant', 'previous'],
            ['system', 'wi'], ['system', 'dice_encounter:context'], ['system', 'shop:effects'],
            ['user', 'dice_check:rules'], ['system', 'preset1000'], ['user', 'input'], ['user', 'dice_check:result'],
        ]);
        const budgeted = await host.budget(messages, 1000);
        assert.deepEqual(budgeted.map(item => [item.role, item.content]), projection);
    });

    test(`ST ${version}: order is not reserved budget; a rule that does not fit is excluded`, async t => {
        const f = fixture(t);
        const request = f.begin();
        f.registry.register(DICE_CHECK_PROMPTS).set('rules', 'dice');
        f.registry.register(TASK_PROMPTS).set('context', 'tasks');
        request.ready();
        const host = native(version, f.manager);
        const messages = await host.inject(f.collect(), [{ role: 'user', content: 'input' }, { role: 'assistant', content: 'previous' }]);
        assert.deepEqual(await host.budget(messages, 8), [{ role: 'user', content: 'input' }]);
        assert.deepEqual(await host.budget(messages, 9), [{ role: 'user', content: 'dice' }, { role: 'user', content: 'input' }]);
        assert.deepEqual(await host.budget(messages, 14), [{ role: 'system', content: 'wi' }, { role: 'user', content: 'dice' }, { role: 'user', content: 'input' }]);
        assert.deepEqual(await host.budget(messages, 24), [
            { role: 'system', content: 'tasks' }, { role: 'assistant', content: 'previous' },
            { role: 'system', content: 'wi' }, { role: 'user', content: 'dice' }, { role: 'user', content: 'input' },
        ]);
    });
}
