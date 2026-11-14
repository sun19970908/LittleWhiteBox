import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createAgentAdapter } from '../provider-config.js';
import { accumulateStreamedAssistantSnapshot, getStreamedSnapshotToolCalls, extractTaggedToolCalls } from '../adapters/openai-compatible.js';
import { normalizeToolCalls, resolveResultToolCalls, buildProviderAssistantToolCallMessage, buildProviderToolResultMessage } from '../runtime/protocol.js';

// Acceptance contracts (cost: wrong file operations, broken tool history, paid retries):
// - Indexed or ID-addressed fragments retain every call's identity and exact arguments.
// - Reused relay indexes never override distinct call IDs; sequential anonymous tails
//   continue the only unfinished call without another paid request.
// - An ambiguous fragment never merges two calls or releases a corrupted executable batch.
// - Concatenated argument objects remain invalid, rather than becoming plausible tool input.
// - Literal JSON in file content and existing single-call streams remain intact.
const root = 'local/cards/回西厢1.png/';
const calls = [
    { id: 'grep', name: 'Grep', arguments: JSON.stringify({ pattern: 'comment', path: root + 'world_book/回西厢', scope: 'local', useRegex: false }) },
    ...['description.md', 'personality.md'].map((file, index) => ({ id: `read-${index}`, name: 'Read',
        arguments: JSON.stringify({ filePath: root + file, scope: 'local' }) })),
];
const native = (call, argumentsText = call.arguments) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: argumentsText } });
const event = tool_calls => ({ choices: [{ delta: { tool_calls } }] });

function fragments(indexed, separate) {
    const starts = calls.map((call, index) => ({ ...(indexed ? { index } : {}), ...native(call, call.arguments.slice(0, 20)) }));
    const tails = calls.map((call, index) => ({ ...(indexed ? { index } : { id: call.id }), function: { arguments: call.arguments.slice(20) } })).reverse();
    return [...(separate ? starts.map(call => event([call])) : [event(starts)]), ...tails.map(call => event([call])),
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }];
}

function relayFragments(reusedIndex, repeatedId) {
    return calls.flatMap(call => [
        event([{ ...(reusedIndex ? { index: 0 } : {}), ...native(call, call.arguments.slice(0, 20)) }]),
        event([{ ...(reusedIndex ? { index: 0 } : {}), ...(repeatedId ? { id: call.id } : {}),
            function: { arguments: call.arguments.slice(20) } }]),
    ]).concat({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
}

test('relay indexes and anonymous sequential tails preserve distinct call IDs', () => {
    for (const reusedIndex of [false, true]) for (const repeatedId of [false, true]) {
        const snapshot = {};
        for (const chunk of relayFragments(reusedIndex, repeatedId)) accumulateStreamedAssistantSnapshot(snapshot, chunk.choices[0]);
        assert.deepEqual(getStreamedSnapshotToolCalls(snapshot), calls);
        assert.deepEqual(snapshot.tool_calls, calls.map(call => native(call)));
    }
});

test('tool identities survive omitted indexes, separate chunks and interleaved same-name calls', () => {
    for (const indexed of [false, true]) for (const separate of [false, true]) {
        const snapshot = {};
        for (const chunk of fragments(indexed, separate)) accumulateStreamedAssistantSnapshot(snapshot, chunk.choices[0]);
        assert.deepEqual(getStreamedSnapshotToolCalls(snapshot), calls);
        assert.deepEqual(snapshot.tool_calls, calls.map(call => native(call)));
    }
});

test('a single call can still continue without repeated identity fields', () => {
    const snapshot = {};
    accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [native(calls[1], calls[1].arguments.slice(0, 20))] } });
    accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [{ function: { arguments: calls[1].arguments.slice(20) } }] } });
    assert.deepEqual(getStreamedSnapshotToolCalls(snapshot), [calls[1]]);
});

test('explicit indexes preserve out-of-order starts and IDs arriving after arguments', () => {
    for (const delayedId of [false, true]) {
        const snapshot = {};
        for (const index of [2, 0, 1]) {
            const start = native(calls[index], calls[index].arguments.slice(0, 20));
            if (delayedId) delete start.id;
            accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [{ index, ...start }] } });
        }
        for (const index of [1, 2, 0]) {
            accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [{ index,
                ...(delayedId ? { id: calls[index].id } : {}),
                function: { arguments: calls[index].arguments.slice(20) },
            }] } });
        }
        assert.deepEqual(snapshot.tool_calls, calls.map(call => native(call)));
    }
});

test('interleaved calls sharing a wire index require IDs until a unique tail remains', () => {
    const snapshot = {};
    for (const call of calls) {
        accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [
            { index: 0, ...native(call, call.arguments.slice(0, 20)) },
        ] } });
    }
    const before = structuredClone(snapshot);
    assert.throws(() => accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [
        { index: 0, function: { arguments: '"local"}' } },
    ] } }), { code: 'OPENAI_COMPATIBLE_TOOL_CALL_IDENTITY_INVALID' });
    assert.deepEqual(snapshot, before);
    for (const index of [1, 0, 2]) {
        accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [{ index: 0,
            ...(index === 2 ? {} : { id: calls[index].id }),
            function: { arguments: calls[index].arguments.slice(20) },
        }] } });
    }
    assert.deepEqual(snapshot.tool_calls, calls.map(call => native(call)));
});

test('ambiguous identities cannot corrupt already received calls', () => {
    for (const unfinished of [false, true]) {
        const snapshot = {};
        accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: calls.map((call, index) => ({ index,
            ...native(call, unfinished ? call.arguments.slice(0, 20) : call.arguments) })) } });
        const before = structuredClone(snapshot);
        assert.throws(() => accumulateStreamedAssistantSnapshot(snapshot, { delta: { tool_calls: [
            { function: { arguments: '"local"}' } },
        ] } }),
            { code: 'OPENAI_COMPATIBLE_TOOL_CALL_IDENTITY_INVALID' });
        assert.deepEqual(snapshot, before);
    }
});

test('concatenated arguments cannot be repaired into a bogus scope or write payload', () => {
    const write = JSON.stringify({ filePath: root + 'description.md', content: 'first' });
    for (const [name, raw] of [
        ['Read', calls.slice(1).map(call => call.arguments).join('')],
        ['Read', calls.map(call => call.arguments).join('')],
        ['Grep', calls[0].arguments + calls[0].arguments],
        ['Write', write + write],
        ['Read', calls[1].arguments + '\n{"filePath":'],
    ]) {
        const call = { id: 'bad-args', name, arguments: raw };
        assert.equal(normalizeToolCalls([call])[0].arguments, raw);
        const tagged = `<tool_call>${JSON.stringify(call)}</tool_call>`;
        assert.equal(extractTaggedToolCalls(tagged)[0].arguments, raw);
        assert.throws(() => JSON.parse(normalizeToolCalls([call])[0].arguments), SyntaxError);
        assert.throws(() => resolveResultToolCalls({ completion: 'complete', toolCalls: [calls[1], call] }),
            { code: 'AGENT_TOOL_ARGUMENTS_INVALID', toolCallId: 'bad-args' });
    }
    const content = 'literal }{ and {"scope":"local"}{"scope":"project"}\n第二行';
    const raw = JSON.stringify({ filePath: root + 'description.md', content });
    for (const input of [raw, raw.replace('\\n', '\n')]) {
        assert.deepEqual(JSON.parse(normalizeToolCalls([{ name: 'Write', arguments: input }])[0].arguments), JSON.parse(raw));
    }
});

for (const target of ['direct', 'hosted', 'browser-bundle', 'backend-bundle']) {
    test(`${target} keeps parallel tool arguments and replay identities through the full stream`, async t => {
        let factory = createAgentAdapter;
        let resolveCalls = resolveResultToolCalls;
        if (target === 'browser-bundle') {
            const manifest = JSON.parse(await readFile(new URL('../../../dist/manifest.json', import.meta.url), 'utf8'));
            const entry = new URL(`../../../dist/${manifest.entries['runtime/agent-core'].file}`, import.meta.url);
            // eslint-disable-next-line no-unsanitized/method -- Entry is owned by the local build manifest.
            const bundle = await import(entry.href);
            factory = bundle.createAgentAdapter;
            resolveCalls = bundle.resolveResultToolCalls;
        } else if (target === 'backend-bundle') {
            const bundle = createRequire(import.meta.url)('../../../server-plugin/littlewhitebox-server/tests/runtime-fixture.js').bundle.agentCore;
            factory = bundle.createAgentAdapter;
            resolveCalls = bundle.resolveResultToolCalls;
        }
        let wire = [];
        let requests = 0;
        const originalFetch = globalThis.fetch;
        t.after(() => { globalThis.fetch = originalFetch; });
        globalThis.fetch = async () => {
            requests++;
            return new Response(wire.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n');
        };
        const hostClient = {
            buildHostChatCompletionGenerateRequest: async body => ({ body }),
            createHostChatCompletion: async () => { throw new Error('Unexpected non-streaming request'); },
            streamHostChatCompletion: async (request, accept, options) => {
                requests++;
                options?.onRequest?.({ body: request });
                for (const chunk of wire) accept(chunk);
            },
        };
        const adapter = factory({ provider: target === 'hosted' ? 'sillytavern-openai-compatible' : 'openai-compatible',
            apiKey: 'unused', baseUrl: 'https://example.invalid/v1', model: 'fixture', toolMode: 'native' }, { hostClient });
        const task = { messages: [{ role: 'user', content: 'Read card files.' }],
            tools: ['Read', 'Grep'].map(name => ({ type: 'function', function: { name, parameters: { type: 'object' } } })),
            onStreamProgress() {} };
        for (const indexed of [false, true]) for (const separate of [false, true]) {
            wire = fragments(indexed, separate);
            const before = requests;
            const result = await adapter.chat(task);
            assert.deepEqual(result.toolCalls, calls);
            assert.deepEqual(resolveCalls(result), calls);
            assert.deepEqual(result.providerPayload.openaiCompatibleMessage.tool_calls, calls.map(call => native(call)));
            assert.equal(requests, before + 1);
        }
        for (const reusedIndex of [false, true]) for (const repeatedId of [false, true]) {
            wire = relayFragments(reusedIndex, repeatedId);
            const before = requests;
            const result = await adapter.chat(task);
            assert.deepEqual(result.toolCalls, calls);
            assert.deepEqual(resolveCalls(result), calls);
            assert.deepEqual(result.providerPayload.openaiCompatibleMessage.tool_calls, calls.map(call => native(call)));
            assert.equal(requests, before + 1);
        }
        // Redacted shape from a captured Gemini-4-argon response: a complete second
        // call reuses index 0 after the first call's anonymous/null-type tail.
        const receiptCalls = ['a.txt', 'b.txt'].map((path, index) => ({
            id: 'receipt-' + index, name: 'Read', arguments: JSON.stringify({ path }),
        }));
        wire = [
            event([{ index: 0, ...native(receiptCalls[0], '') }]),
            event([{ index: 0, type: null, function: { arguments: receiptCalls[0].arguments } }]),
            { choices: [{ delta: { tool_calls: [{ index: 0, ...native(receiptCalls[1]) }] }, finish_reason: 'tool_calls' }] },
            { choices: [], usage: { total_tokens: 147 } },
        ];
        const beforeReceipt = requests;
        const receiptResult = await adapter.chat(task);
        assert.equal(requests, beforeReceipt + 1);
        assert.deepEqual(receiptResult.toolCalls, receiptCalls);
        assert.deepEqual(receiptResult.providerPayload.openaiCompatibleMessage.tool_calls, receiptCalls.map(call => native(call)));
        const reloadedHistory = JSON.parse(JSON.stringify([
            ...task.messages,
            buildProviderAssistantToolCallMessage(receiptResult, receiptResult.toolCalls),
            ...receiptResult.toolCalls.map(call => buildProviderToolResultMessage({
                toolCallId: call.id, toolName: call.name, content: '{"ok":true}',
            })),
        ]));
        wire = [{ choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] }];
        const continued = await adapter.chat({ ...task, messages: reloadedHistory });
        assert.equal(requests, beforeReceipt + 2);
        const sentHistory = continued.requestInspection.request.body.messages;
        assert.deepEqual(sentHistory.find(message => message.role === 'assistant').tool_calls, receiptCalls.map(call => native(call)));
        assert.deepEqual(sentHistory.filter(message => message.role === 'tool').map(message => message.tool_call_id),
            receiptCalls.map(call => call.id));
        assert.equal(continued.text, 'OK');
        wire = [event(calls.map((call, index) => ({ index, ...native(call) }))), event([{ function: { arguments: '{}' } }])];
        const before = requests;
        await assert.rejects(adapter.chat(task), { code: 'OPENAI_COMPATIBLE_TOOL_CALL_IDENTITY_INVALID' });
        assert.equal(requests, before + 1);
        assert.throws(() => resolveCalls({ completion: 'complete', toolCalls: [calls[0], {
            id: 'merged-read', name: 'Read', arguments: calls[1].arguments + calls[2].arguments,
        }] }), { code: 'AGENT_TOOL_ARGUMENTS_INVALID', toolCallId: 'merged-read' });
    });
}
