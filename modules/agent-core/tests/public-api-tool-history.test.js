import assert from 'node:assert/strict';
import test from 'node:test';
import * as agentCore from '../browser-entry.js';
import { createPublicAgentApi } from '../public-api.js';

// External protocol contract: callers submit standard tool-call history only. Gemini over
// OpenAI-compatible rejects unsigned replayed calls, and DeepSeek thinking with tools rejects
// replayed calls without non-empty reasoning. The Agent layer projects both at send time,
// never altering real model output or the caller's history.
const SKIP = 'skip_thought_signature_validator';
const tools = [{ type: 'function', function: { name: 'submit', parameters: { type: 'object', properties: {} } } }];
const call = (id, name = 'read_material') => ({ id, type: 'function', function: { name, arguments: '{}' } });
const builtHistory = (text = 'First, I will read the material.') => [
    { role: 'user', content: 'Write the next chapter.' },
    { role: 'assistant', content: text, tool_calls: [call('read')] },
    { role: 'tool', tool_call_id: 'read', content: JSON.stringify({ material: 'fixture' }) },
];

function harness(t, model, reasoning, replies = []) {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (input, init) => {
        const request = new Request(input, init);
        assert.equal(new URL(request.url).hostname, 'offline.invalid');
        requests.push(await request.json());
        const message = replies[requests.length - 1]
            || { role: 'assistant', content: 'done' };
        return new Response(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }),
            { headers: { 'Content-Type': 'application/json' } });
    });
    const config = { provider: 'openai-compatible', model, apiKey: 'offline-fixture', baseUrl: 'https://offline.invalid',
        toolMode: 'native', maxTokens: 64, reasoning };
    const settings = agentCore.normalizeAgentSettings({ currentPresetName: 'offline', presets: { offline: config } });
    const { api } = createPublicAgentApi({ isEnabled: () => true, loadSettings: () => settings, loadCore: () => agentCore });
    return { api, requests, settings };
}

async function send(api, messages) {
    const session = await api.openSession();
    try { return await session.chat({ messages, tools }); } finally { session.dispose(); }
}

const toolCallMessages = body => body.messages.filter(message => message.tool_calls);

test('Gemini over OpenAI-compatible signs caller-built calls and keeps real signatures', async t => {
    const signed = { role: 'assistant', content: '', tool_calls: [
        { ...call('live-1', 'submit'), extra_content: { google: { thought_signature: 'model-signature' } } },
        call('live-2', 'submit'),
    ] };
    const { api, requests } = harness(t, 'gemini-3-flash-preview', { mode: 'inherit' }, [signed]);
    const history = builtHistory();
    const original = structuredClone(history);
    const session = await api.openSession();
    const first = await session.chat({ messages: history, tools });
    const results = first.toolCalls.map(item => session.toolResult(item, { ok: true }));
    await session.chat({ messages: [...history, first.reply, ...results], tools });
    session.dispose();

    assert.deepEqual(history, original);
    const [built, live] = toolCallMessages(requests[1]);
    assert.deepEqual(built.tool_calls[0].extra_content, { google: { thought_signature: SKIP, thoughtSignature: SKIP } });
    assert.equal(built.tool_calls[0].provider_specific_fields, undefined);
    // A signature covers its whole parallel batch; the unsigned sibling must stay unsigned.
    assert.deepEqual(live.tool_calls.map(item => item.extra_content?.google?.thought_signature), ['model-signature', undefined]);
});

for (const mode of ['inherit', 'on']) {
    test(`DeepSeek ${mode} with tools gives caller-built calls their text as reasoning, keeps real reasoning`, async t => {
        const live = { role: 'assistant', content: '', reasoning_content: 'model reasoning', tool_calls: [call('live', 'submit')] };
        const { api, requests, settings } = harness(t, 'deepseek-v4-flash', { mode, effort: 'high' }, [live, live]);
        const settingsBefore = structuredClone(settings);
        const history = builtHistory();
        const original = structuredClone(history);
        const session = await api.openSession();
        let messages = history;
        for (let round = 0; round < 2; round += 1) {
            const result = await session.chat({ messages, tools });
            messages = [...messages, result.reply, ...result.toolCalls.map(item => session.toolResult(item, { ok: true }))];
        }
        await session.chat({ messages, tools });
        session.dispose();

        assert.deepEqual(history, original);
        assert.deepEqual(settings, settingsBefore);
        assert.equal(requests[0].thinking?.type, mode === 'on' ? 'enabled' : undefined);
        for (const body of requests) {
            const [built, ...real] = toolCallMessages(body);
            assert.equal(built.reasoning_content, history[1].content);
            for (const message of real) assert.equal(message.reasoning_content, 'model reasoning');
        }
        assert.equal(toolCallMessages(requests[2]).length, 3);
    });
}

test('DeepSeek thinking rejects a caller-built call with no text before any request', async t => {
    const { api, requests } = harness(t, 'deepseek-v4-flash', { mode: 'inherit' });
    await assert.rejects(send(api, builtHistory('')), { code: 'AGENT_TOOL_HISTORY_REASONING_MISSING' });
    assert.equal(requests.length, 0);
});

for (const [model, reasoning, expected] of [
    ['deepseek-v4-flash', { mode: 'off' }, ''],
    ['gpt-4.1', { mode: 'inherit' }, undefined],
]) {
    test(`${model}/${reasoning.mode} sends caller-built calls without projected reasoning or signatures`, async t => {
        const { api, requests } = harness(t, model, reasoning);
        await send(api, builtHistory());
        const [built] = toolCallMessages(requests[0]);
        assert.equal(built.reasoning_content, expected);
        assert.equal(Object.hasOwn(built.tool_calls[0], 'extra_content'), false);
    });
}
