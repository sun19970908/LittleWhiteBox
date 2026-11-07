import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { compileDefinition } from '../definition/compile.js';
import { equipmentExample } from '../definition/example.js';
import { initialize, settle } from '../engine/settle.js';
import { buildRoleplayView, buildUpdateView } from '../model/views.js';
import { getInputSchema, getTools, SUBMIT_TOOL } from '../model/tools.js';
import { buildUpdateTask, correctionMessages } from '../model/prompts.js';
import { accepted } from './fixture.js';
import type { AgentChatResult, AgentToolCall, AgentToolResult } from '../../../agent-core/public-api.js';
import type { Json } from '../types.js';

test('K9: V5 supplies three ordered exchanges; correction retains the actual provider reply and tool results', async () => {
    const compiled = compileDefinition(equipmentExample()), start = accepted(await initialize(compiled));
    const context = { target: { floor: 2, swipeId: 0 }, messages: [{ role: 'assistant', content: 'Completed passage.' }] };
    const task = buildUpdateTask(compiled, start.state, context);
    const exchanges = task.messages.filter(message => message.role === 'tool');
    assert.deepEqual(exchanges.map(message => message.toolName), ['read_manuscript', 'read_writing_guide', 'request_write_approval']);
    assert.deepEqual(JSON.parse(String(exchanges[0].content)), context);
    assert.deepEqual(JSON.parse(String(exchanges[1].content)), buildUpdateView(compiled, start.state));
    assert.equal(task.toolChoice, 'auto'); assert.equal(task.tools![0].function.name, 'write');
    const call: AgentToolCall = { id: 'local', providerId: 'remote', name: SUBMIT_TOOL, arguments: '{"state":[]}' };
    const response: Pick<AgentChatResult, 'toolCalls' | 'reply'> = { toolCalls: [call], reply: { role: 'assistant', content: '',
        providerPayload: { openaiCompatibleMessage: { reasoning_content: 'provider replay' } },
        tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] } };
    const received: unknown[] = [];
    const messages = correctionMessages(response, [{ code: 'action-precondition' }], (original, result) => {
        received.push({ original, result });
        return { role: 'tool', toolName: original.name, tool_call_id: original.id, content: JSON.stringify(result) };
    });
    assert.deepEqual(messages[0], response.reply);
    assert.equal(received.length, 1);
    assert.equal((messages[1] as AgentToolResult).tool_call_id, call.id);
});

test('K2/K9: generated paths exclude derived and action-only fields; confirmed RP results use scoped values', async () => {
    const compiled = compileDefinition(equipmentExample());
    const validate = new Ajv({ strict: false }).compile(getInputSchema(compiled));
    assert.equal(validate([{ op: 'set', path: ['hero', 'health'], value: 50, reason: 'healed', old: 40 }]), true);
    for (const path of [['hero'], ['hero', 'maxHealth'], ['hero', 'amulet']]) {assert.equal(validate([{ op: 'set', path, value: 1 }]), false);}
    const start = accepted(await initialize(compiled)), result = accepted(await settle(compiled, start.state, [{ action: 'unequip', params: {} }]));
    assert.equal(Object.hasOwn(buildRoleplayView(compiled, start.state, { result }), 'result'), false);
    const view = buildRoleplayView(compiled, result.state, { sections: ['equipment'], result: { ...result, committed: true } });
    assert.equal(view.result?.committed, true);
    assert.equal(Object.hasOwn(view, 'state'), false);
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
    bundle.definition.access = ['profile', 'bag', 'people'].map(key => ({ path: [key], write: ['direct'], description: key }));
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
