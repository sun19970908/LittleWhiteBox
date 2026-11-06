// Build-artifact acceptance: source-only tests cannot prove the shipped runtime exposes
// the public facade or keeps its replay helpers in the same browser dependency graph.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the shipped Agent entry supports caller-owned replay and host invalidation', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../../dist/manifest.json', import.meta.url), 'utf8'));
    const entry = new URL(`../../../dist/${manifest.entries['runtime/agent-core'].file}`, import.meta.url);
    // eslint-disable-next-line no-unsanitized/method -- Entry is from the repository's generated build manifest.
    const core = await import(entry.href);
    const settings = core.normalizeAgentSettings({
        provider: 'google',
        modelConfigs: { google: { model: 'fixture', apiKey: '', maxTokens: 512 } },
    });
    let enabled = true;
    let loads = 0;
    const sent = [];
    const payload = { googleContents: [{ role: 'model', parts: [{
        functionCall: { name: 'record', args: { value: 1 } }, thoughtSignature: 'fixture-signature',
    }] }] };
    const { api, cancelAll } = core.createPublicAgentApi({
        isEnabled: () => enabled,
        loadSettings: () => { loads++; return structuredClone(settings); },
        loadCore: async () => ({ createAgentAdapter: () => ({ async chat(task) {
            sent.push(task);
            return sent.length === 1 ? {
                text: '', completion: 'complete', finishReason: 'STOP', truncated: false,
                toolCalls: [{ id: 'local-1', providerId: '', name: 'record', arguments: '{"value":1}' }],
                providerPayload: payload,
            } : { text: 'done', toolCalls: [], completion: 'complete', finishReason: 'STOP', truncated: false };
        } }) }),
    });
    const session = await api.openSession({ api: 'main' });
    const tools = [{ type: 'function', function: { name: 'record', parameters: { type: 'object' } } }];
    const messages = [{ role: 'user', content: 'fixture' }];
    const first = await session.chat({ messages, tools });
    assert.equal(sent.length, 1);
    assert.equal(first.toolCalls[0].providerId, '');
    messages.push(JSON.parse(JSON.stringify(first.reply)), session.toolResult(first.toolCalls[0], false));
    const second = await session.chat({ messages, tools });
    assert.equal(second.text, 'done');
    assert.equal(sent.length, 2);
    assert.equal(loads, 1);
    assert.equal(sent[1].maxTokens, 512);
    assert.deepEqual(sent[1].messages[1].providerPayload, payload);
    assert.equal(sent[1].messages[1].tool_calls[0].providerToolCallId, '');
    assert.deepEqual(JSON.parse(sent[1].messages[2].content), { result: false });
    assert.equal(Object.hasOwn(first, 'requestInspection'), false);
    enabled = false;
    cancelAll();
    await assert.rejects(session.chat({ messages }), { code: 'AGENT_DISABLED' });
    assert.equal((await api.getStatus()).enabled, false);
    enabled = true;
    const next = await api.openSession({ api: 'main' });
    next.dispose();
    await assert.rejects(next.chat({ messages }), { code: 'AGENT_SESSION_DISPOSED' });
});
