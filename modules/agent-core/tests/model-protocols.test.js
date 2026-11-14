import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleAdapter } from '../adapters/google.js';
import { GoogleVertexAdapter } from '../adapters/google-vertex.js';
import { AnthropicAdapter } from '../adapters/anthropic.js';
import { OpenAIResponsesAdapter } from '../adapters/openai-responses.js';
import { OpenAICompatibleAdapter } from '../adapters/openai-compatible.js';

// Contracts (cost: broken relay requests, lost settings or tool calls):
// - Google 2.5 sends budgets; level-based channels gain XHIGH even for aliases.
// - SDK upgrades preserve cross-model Messages and OpenAI-compatible requests.
// - Vertex auth modes preserve opaque model names and the existing channel defaults.
const task = { messages: [{ role: 'user', content: 'offline' }], maxTokens: 8192 };
const config = model => ({ model, apiKey: 'offline-fixture', baseUrl: 'https://relay.invalid' });
const tool = { type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: {} } } };
const sampling = { topP: { enabled: true, value: 0.83 }, topK: { enabled: true, value: 37 } };

test('Google adds budget and XHIGH support without requiring official addresses or model names', () => {
    for (const model of ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
        const input = { ...task, reasoning: { mode: 'on', budgetTokens: 2048 } };
        const original = structuredClone(input);
        const body = new GoogleAdapter(config(model)).buildChatPayload(input).createPayload.config;
        assert.equal(body.thinkingConfig.thinkingBudget, 2048);
        assert.equal(body.thinkingConfig.thinkingLevel, undefined);
        assert.deepEqual(input, original);
    }
    for (const model of ['gemini-4-hydrogen', 'gemini-4-argon', 'gemini-4-carbon', '商家/自定义旗舰', 'deepseek-relabelled']) {
        const adapter = new GoogleAdapter(config(model));
        assert.equal(adapter.buildChatPayload({ ...task, reasoning: { mode: 'on', effort: 'xhigh' } })
            .createPayload.config.thinkingConfig.thinkingLevel, 'XHIGH');
        assert.equal(adapter.buildChatPayload({ ...task, reasoning: { mode: 'on', effort: 'minimal' } })
            .createPayload.config.thinkingConfig.thinkingLevel, 'MINIMAL');
    }
});

test('Claude-compatible channels preserve cross-model controls, sampling and caller settings', () => {
    for (const model of ['deepseek-chat', '商家自定义', 'claude-sonnet-4-5', 'claude-opus-5-5']) {
        const saved = { ...config(model), sampling };
        const before = structuredClone(saved);
        const adapter = new AnthropicAdapter(saved);
        const on = adapter.buildRequestBody({ ...task, reasoning: { mode: 'on', effort: 'xhigh' } });
        assert.equal(on.model, model);
        assert.equal(on.thinking.type, 'adaptive');
        assert.equal(on.output_config.effort, 'xhigh');
        assert.equal(adapter.buildRequestBody({ ...task, reasoning: { mode: 'off' } }).thinking.type, 'disabled');
        assert.equal(adapter.buildRequestBody(task).thinking, undefined);
        if (!model.startsWith('claude-')) {
            assert.equal(on.top_p, 0.83);
            assert.equal(on.top_k, 37);
        }
        assert.deepEqual(saved, before);
    }
});

test('OpenAI-compatible relays keep native tools, sampling and off controls across model names', () => {
    for (const model of ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-4o', 'gemini-4-hydrogen', 'claude-opus-5-5', '任意别名']) {
        const saved = { ...config(model), sampling };
        const before = structuredClone(saved);
        const adapter = new OpenAICompatibleAdapter(saved);
        for (const mode of ['inherit', 'on', 'off']) {
            const body = adapter.buildRequestBody({ ...task, tools: [tool], reasoning: { mode, effort: 'high' } });
            assert.equal(body.model, model);
            assert.deepEqual(body.tools, [tool]);
            assert.equal(body.top_p, 0.83);
            assert.equal(body.top_k, 37);
        }
        const responses = new OpenAIResponsesAdapter(saved).buildRequestBody({ ...task, tools: [tool], reasoning: { mode: 'off' } });
        assert.equal(responses.tools[0].name, 'read_file');
        assert.equal(responses.reasoning.effort, 'none');
        assert.deepEqual(saved, before);
    }
});

test('Vertex retains its channel contract across relay, Express and service-account modes', () => {
    const account = JSON.stringify({ type: 'service_account', project_id: 'fixture-project',
        client_email: 'fixture@fixture-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----' });
    for (const authMode of ['relay', 'api-key', 'service-account']) {
        for (const model of ['gemini-4-hydrogen', '改名/Vertex旗舰', 'gemini-2.5-pro']) {
            const saved = { ...config(model), sampling, vertex: { authMode, serviceAccountJson: account } };
            const before = structuredClone(saved);
            const adapter = new GoogleVertexAdapter(saved);
            const body = adapter.buildChatPayload({ ...task, temperature: 0.2, reasoning: { mode: 'on', effort: 'xhigh' } }).createPayload.config;
            assert.equal(body.thinkingConfig.thinkingLevel, 'XHIGH');
            assert.equal(body.thinkingConfig.thinkingBudget, undefined);
            assert.equal(body.temperature, undefined);
            assert.equal(body.topP, undefined);
            assert.equal(adapter.buildChatPayload({ ...task, reasoning: { mode: 'on' } }).createPayload.config.thinkingConfig.thinkingLevel, 'MEDIUM');
            assert.deepEqual(saved, before);
        }
    }
});
