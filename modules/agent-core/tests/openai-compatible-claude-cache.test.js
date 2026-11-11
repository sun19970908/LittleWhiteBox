import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAICompatibleAdapter } from '../adapters/openai-compatible.js';

// Contract: Claude routed through an OpenAI-compatible relay receives explicit
// cache_control breakpoints; every other model family receives the request unchanged.
const cacheControl = { type: 'ephemeral' };
const tool = { type: 'function', function: { name: 'Read', description: 'Fixture tool.', parameters: { type: 'object', properties: {} } } };
const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } };
const build = (model, task, toolMode = 'native') => new OpenAICompatibleAdapter({ apiKey: 'fixture', model, toolMode }).buildRequestBody(task);

test('Claude marks the system prefix and the newest input, advancing without mutating history', () => {
    const task = { systemPrompt: 'Stable system.', tools: [tool], messages: [{ role: 'user', content: 'First turn.' }] };
    const original = structuredClone(task);
    const first = build('anthropic/claude-sonnet-4.5', task);
    assert.deepEqual(first.messages[0], { role: 'system', content: [{ type: 'text', text: 'Stable system.', cache_control: cacheControl }] });
    assert.deepEqual(first.messages[1].content, [{ type: 'text', text: 'First turn.', cache_control: cacheControl }]);
    assert.deepEqual(task, original);

    const next = { ...task, messages: [...task.messages,
        { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'Read', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    ] };
    const second = build('anthropic/claude-sonnet-4.5', next);
    assert.deepEqual(second.messages[0], first.messages[0]);
    assert.equal(second.messages[1].content, 'First turn.');
    assert.deepEqual(second.messages.at(-1).content, [{ type: 'text', text: '{"ok":true}', cache_control: cacheControl }]);
});

test('Claude marks the last text part of multimodal input and leaves caller parts untouched', () => {
    const content = [{ type: 'text', text: 'Look.' }, image];
    const task = { messages: [{ role: 'user', content }] };
    const body = build('claude-opus-4-6', task);
    assert.deepEqual(body.messages[0].content, [{ type: 'text', text: 'Look.', cache_control: cacheControl }, image]);
    assert.equal(Object.hasOwn(content[0], 'cache_control'), false);
});

test('Claude tagged mode marks the same breakpoints', () => {
    const body = build('claude-opus-4-6', { systemPrompt: 'Stable system.', tools: [tool], messages: [{ role: 'user', content: 'Go.' }] }, 'tagged-json');
    assert.deepEqual(body.messages[0].content.at(-1).cache_control, cacheControl);
    assert.deepEqual(body.messages.at(-1).content.at(-1).cache_control, cacheControl);
});

test('non-Claude models keep the exact existing request', () => {
    const task = { systemPrompt: 'Stable system.', tools: [tool], messages: [{ role: 'user', content: [{ type: 'text', text: 'Look.' }, image] }] };
    for (const model of ['gpt-5', 'deepseek-chat', 'gemini-2.5-pro', 'custom-alias']) {
        const body = build(model, task);
        assert.equal(JSON.stringify(body).includes('cache_control'), false, model);
        assert.equal(body.messages[0].content, 'Stable system.', model);
    }
});
