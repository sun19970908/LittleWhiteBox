import assert from 'node:assert/strict';
import test from 'node:test';
import {
    accumulateStreamedAssistantSnapshot,
    assertSignedToolCallsIntact,
    buildNativeMessages,
    buildProviderPayload,
    buildToolCallResultsFromOpenAI,
} from '../adapters/openai-compatible.js';
import { buildProviderAssistantToolCallMessage } from '../runtime/protocol.js';

// External relay contract: the suffix in a tool-call ID is an opaque signature,
// not a new ID to normalize or a signature to decode. One signed call protects
// the complete parallel batch, including siblings without their own signature.
const SIGNED_ID = 'call-read__thought__opaque:not-decoded+/=';
const call = (id, argumentsText = '{}') => ({
    id, type: 'function', function: { name: 'lookup', arguments: argumentsText },
});
const user = { role: 'user', content: 'Read the material.' };
const signedMessage = () => ({ role: 'assistant', content: '', tool_calls: [
    call(SIGNED_ID, '{"path":"state.md"}'),
    call('call-parallel', '{"pattern":"todo"}'),
] });
const results = calls => calls.map(item => ({ role: 'tool', tool_call_id: item.id, content: '{"ok":true}' }));

for (const historical of [false, true]) {
    test(`ID-signed parallel replay preserves the native batch ${historical ? 'across turns' : 'within the tool loop'}`, () => {
        const native = signedMessage();
        const toolCalls = buildToolCallResultsFromOpenAI(native.tool_calls);
        const reply = buildProviderAssistantToolCallMessage({ text: '', providerPayload: buildProviderPayload(native) }, toolCalls);
        // A caller can rebuild executable arguments; that must not overwrite an
        // opaque signed receipt, even on its unsigned parallel sibling.
        for (const item of reply.tool_calls) item.function.arguments = '{ "rebuilt": true }';
        reply.tool_calls[0].id = 'rebuilt-local-id';
        const messages = [user, JSON.parse(JSON.stringify(reply)), ...results(native.tool_calls),
            ...(historical ? [{ role: 'user', content: 'Continue.' }] : [])];
        const original = structuredClone(messages);
        const sent = buildNativeMessages({ messages }, 'gemini-3-flash-preview');

        assert.deepEqual(sent[1].tool_calls, native.tool_calls);
        assert.deepEqual(sent.slice(2, 4).map(item => item.tool_call_id), native.tool_calls.map(item => item.id));
        assert.deepEqual(messages, original);
    });
}

test('ID-signed calls without a native payload retain their opaque IDs without synthetic signatures', () => {
    const native = signedMessage();
    const sent = buildNativeMessages({ messages: [user, native, ...results(native.tool_calls)] }, 'gemini-3-flash-preview');
    assert.deepEqual(sent[1].tool_calls, native.tool_calls);
});

test('streamed ID signatures protect the assembled parallel batch and remain opaque on replay', () => {
    const snapshot = { role: 'assistant' };
    accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [
        { index: 0, ...call(SIGNED_ID, '{"path":') },
        { index: 1, ...call('call-parallel', '{"pattern":') },
    ] } });
    accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [
        { index: 0, id: '', function: { arguments: '"state.md"}' } },
        { index: 1, id: '', function: { arguments: '"todo"}' } },
    ] }, finish_reason: 'tool_calls' });
    assertSignedToolCallsIntact(snapshot);
    const native = signedMessage();
    assert.deepEqual(snapshot.tool_calls, native.tool_calls);
    const reply = buildProviderAssistantToolCallMessage({ text: '', providerPayload: buildProviderPayload(snapshot) },
        buildToolCallResultsFromOpenAI(snapshot.tool_calls));
    const sent = buildNativeMessages({ messages: [user, reply, ...results(native.tool_calls)] }, 'gemini-3-flash-preview');
    assert.deepEqual(sent[1].tool_calls, native.tool_calls);
});

for (const [label, calls, reason] of [
    ['truncated signed arguments', [call(SIGNED_ID, '{"path":')], 'invalid_function_arguments'],
    ['missing signed arguments', [{ id: SIGNED_ID, type: 'function', function: { name: 'lookup' } }], 'invalid_function_arguments'],
    ['truncated unsigned sibling', [call(SIGNED_ID), call('call-parallel', '{"path":')], 'invalid_function_arguments'],
    ['invalid unsigned sibling shape', [call(SIGNED_ID), { id: 'call-parallel' }], 'invalid_function_shape'],
    ['empty ID signature', [call('call-read__thought__')], 'invalid_thought_signature'],
    ['empty ID signature on a sibling', [call(SIGNED_ID), call('call-parallel__thought__')], 'invalid_thought_signature'],
]) {
    test(`ID-signed batches reject ${label} before argument normalization`, () => {
        assert.throws(() => assertSignedToolCallsIntact({ tool_calls: calls }), error => {
            assert.equal(error.reason, reason);
            return true;
        });
    });
}
