import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { compileDefinition } from '../definition/compile.js';
import { equipmentExample } from '../definition/example.js';
import { initialize, settle } from '../engine/settle.js';
import { buildDescriptionView, buildUpdateView } from '../model/views.js';
import { getInputSchema, getTools } from '../model/tools.js';
import { buildUpdateTask } from '../model/prompts.js';
import { correctionTask } from '../../updater/correction.js';
import { accepted, fixture } from './fixture.js';
import * as agentCore from '../../../agent-core/browser-entry.js';
import { createPublicAgentApi } from '../../../agent-core/public-api.js';
import type { Json, JsonObject } from '../types.js';

test('K9: V5 supplies three ordered exchanges; correction appends the rejected response and diagnostics to the same task', async () => {
    const compiled = compileDefinition(equipmentExample()), start = accepted(await initialize(compiled));
    const context = { target: { floor: 2, swipeId: 0 }, messages: [{ role: 'assistant', content: 'Completed passage.' }] };
    const task = buildUpdateTask(compiled, start.state, context);
    const exchanges = task.messages.filter(message => message.role === 'tool');
    assert.deepEqual(exchanges.map(message => message.toolName), ['read_manuscript', 'read_writing_guide', 'request_write_approval']);
    assert.deepEqual(JSON.parse(String(exchanges[0].content)), context);
    assert.deepEqual(JSON.parse(String(exchanges[1].content)), buildUpdateView(compiled, start.state));
    assert.equal(task.toolChoice, 'auto'); assert.equal(task.tools![0].function.name, 'write');
    const submission = { text: '', toolCalls: [{ id: 'local', name: 'write', arguments: '{"state":[]}' }], completion: 'complete', truncated: false };
    const corrected = correctionTask(task, submission, [{ code: 'action-precondition' }], 'state');
    assert.deepEqual(corrected.messages.slice(0, -1), task.messages);
    const appended = corrected.messages.at(-1)!;
    assert.equal(appended.role, 'user');
    assert.deepEqual(JSON.parse(String(appended.content).slice(String(appended.content).indexOf('\n\n') + 2)), { submission, errors: [{ code: 'action-precondition' }] });
});

// DeepSeek thinking with tools rejects replayed calls without reasoning; the Agent layer
// derives it from each platform-supplied call's text, so V5 must be sendable with thinking.
test('K9: V5 exchanges are sendable to DeepSeek with provider-default thinking', async t => {
    const compiled = compileDefinition(equipmentExample()), start = accepted(await initialize(compiled));
    const task = buildUpdateTask(compiled, start.state, { target: { floor: 2, swipeId: 0 }, messages: [] });
    const bodies: { messages: { tool_calls?: unknown[], reasoning_content?: string }[] }[] = [];
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        assert.equal(new URL(request.url).hostname, 'offline.invalid');
        bodies.push(await request.json());
        return Response.json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'done' } }] });
    });
    const settings = agentCore.normalizeAgentSettings({ currentPresetName: 'offline', presets: { offline: {
        provider: 'openai-compatible', model: 'deepseek-v4-flash', apiKey: 'offline-fixture', baseUrl: 'https://offline.invalid',
        toolMode: 'native', maxTokens: 64, reasoning: { mode: 'inherit' } } } });
    const { api } = createPublicAgentApi({ isEnabled: () => true, loadSettings: () => settings, loadCore: async () => agentCore });
    const session = await api.openSession();
    await session.chat(task);
    session.dispose();
    const replayed = bodies[0].messages.filter(message => message.tool_calls);
    assert.equal(replayed.length, 3);
    for (const message of replayed) {assert.ok(message.reasoning_content?.trim());}
});

// K2/K9: provider-compatible paths retain their shape; forbidden writes publish nothing
// and the update view identifies writable fields (protocol failure / state corruption).
test('K2/K9: path schemas avoid array enums, settlement enforces permissions and RP descriptions expose only facts', async () => {
    const compiled = compileDefinition(equipmentExample());
    const schema = getInputSchema(compiled), validate = new Ajv({ strict: false }).compile(schema);
    for (const variant of (schema.items as JsonObject).anyOf as JsonObject[]) {
        const path = (variant.properties as JsonObject).path as JsonObject | undefined;
        if (!path) {continue;}
        assert.equal(Object.hasOwn(path, 'enum'), false);
        assert.equal(path.type, 'array'); assert.deepEqual(path.items, { type: 'string' });
        assert.equal(path.minItems, 2); assert.equal(typeof path.description, 'string');
    }
    assert.equal(validate([{ op: 'set', path: ['hero', 'health'], value: 50, reason: 'healed', old: 40 }]), true);
    assert.equal(validate([{ op: 'set', path: ['hero'], value: 1 }]), false);
    assert.equal(validate([{ op: 'set', path: ['hero', 1], value: 1 }]), false);
    const host = fixture(); accepted(await host.service.enable(equipmentExample()));
    for (const path of [['hero'], ['hero', 'maxHealth'], ['hero', 'amulet'], ['hero', 'absent']]) {
        const before = host.saved();
        const result = await host.service.apply([{ op: 'set', path: ['hero', 'health'], value: 50 }, { op: 'set', path, value: 1 }]);
        assert.equal(result.ok, false); assert.deepEqual(host.saved(), before);
    }
    const view = buildDescriptionView(compiled, ['equipment']);
    assert.deepEqual(view.fields, [{ path: ['hero', 'amulet'], description: compiled.definition.access[2].description }]);
    for (const key of ['state', 'values', 'result']) {assert.equal(Object.hasOwn(view, key), false);}
    assert.ok(view.actions.every(item => typeof item === 'string'));
    assert.deepEqual(view.rules, [compiled.definition.rules[0].description]);
    assert.deepEqual(view.constraints, []);
    assert.deepEqual(buildDescriptionView(compiled, ['character']).constraints, [compiled.definition.constraints[0].description]);
    const facts = equipmentExample(), get = (...path: string[]) => ({ get: path }), unchanged = { type: 'object', additionalProperties: false, properties: {} };
    facts.definition.rules = []; facts.definition.constraints = [];
    facts.definition.actions.push({ id: 'heal', title: 'Heal', parameters: unchanged, conversions: [], description: 'A healing spell restores 10 health.', requires: { literal: true },
        effects: [{ path: ['hero', 'health'], value: { op: 'add', args: [get('hero', 'health'), { literal: 10 }] } }] });
    facts.definition.triggers = [
        { id: 'amulet-rest', description: 'Resting heals more while wearing the amulet.', when: { literal: false }, effects: [{ path: ['hero', 'health'], value: { op: 'if', args: [get('hero', 'amulet'), { literal: 20 }, { literal: 10 }] } }] },
        { id: 'earlier-amulet', description: 'Removing the amulet leaves a scar.', when: { literal: false }, effects: [{ path: ['hero', 'health'], value: { op: 'if', args: [{ before: ['hero', 'amulet'] }, { literal: 1 }, { literal: 2 }] } }] },
    ];
    const factView = (section: string) => buildDescriptionView(compileDefinition(facts), [section]);
    assert.ok(factView('character').actions.includes('A healing spell restores 10 health.'));
    assert.equal(factView('equipment').actions.includes('A healing spell restores 10 health.'), false);
    assert.deepEqual(factView('equipment').triggers, ['Resting heals more while wearing the amulet.', 'Removing the amulet leaves a scar.']);
    assert.equal(Object.hasOwn(view.sections[0], 'values'), false);
    const guide = buildUpdateView(compiled, accepted(await initialize(compiled)).state);
    assert.deepEqual(guide.writable.map(field => field.path), [['hero', 'health']]);
    assert.equal(guide.fields.find(field => field.path.join('.') === 'hero.health')?.update, compiled.definition.access[1].update);
    assert.equal(new Ajv({ strict: false }).compile(getTools(compiled)[0].function.parameters)({ state: [] }), true);
});

test('K9: optional objects, dynamic keys, arrays and composite schemas remain writable through the model interface', async () => {
    const bundle = equipmentExample();
    bundle.definition.schema = { type: 'object', additionalProperties: false, properties: {
        profile: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { anyOf: [{ type: 'string' }, { type: 'null' }] } } },
        bag: { type: 'array', items: { type: 'string' } },
        people: { type: 'object', additionalProperties: { type: 'number' } },
    } };
    bundle.definition.initial = {}; bundle.definition.rules = []; bundle.definition.actions = []; bundle.definition.constraints = [];
    bundle.definition.access = ['profile', 'bag', 'people'].map(key => ({ path: [key], direct: true, description: key }));
    const compiled = compileDefinition(bundle), validate = new Ajv({ strict: false }).compile(getInputSchema(compiled));
    const inputs = [
        [{ op: 'set', path: ['profile'], value: { name: 'Alice' } }],
        [{ op: 'set', path: ['bag'], value: [] }, { op: 'set', path: ['bag', '0'], value: 'map' }],
        [{ op: 'set', path: ['people'], value: {} }, { op: 'set', path: ['people', 'Lv.3'], value: 3 }],
    ];
    let state: Json = {};
    for (const input of inputs) {
        assert.equal(validate(input), true, JSON.stringify(validate.errors));
        state = accepted(await settle(compiled, state, input)).state;
    }
});
