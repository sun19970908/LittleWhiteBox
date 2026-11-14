import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentAdapter } from '../provider-config.js';
import { buildProviderAssistantToolCallMessage, buildProviderToolResultMessage } from '../runtime/protocol.js';

// Acceptance (protocol failure / broken chat):
// - Google AI and Vertex never replay unsigned empty text parts, whether standalone
//   chunks or mixed into a tool turn, in live sessions or saved/reloaded history.
// - Cleanup preserves call IDs, arguments, signatures, nonempty text and tool results.
for (const provider of ['google', 'google-vertex']) {
    for (const streaming of [true, false]) {
        test(`${provider} ${streaming ? 'stream' : 'JSON'} removes empty text from live and reloaded tool turns`, async t => {
            const config = { provider, model: 'offline-model', apiKey: 'offline-secret',
                baseUrl: 'https://offline.invalid', vertex: { authMode: 'relay' } };
            const callPart = { functionCall: { id: 'call_fixture', name: 'ReadSkill', args: { id: 'builtin-card-files', empty: '' } },
                thoughtSignature: 'signed-call' };
            const preservedParts = [callPart, { text: '', thoughtSignature: 'signed-text' }, { text: ' ' }];
            const rawParts = [callPart, { text: '' }, ...preservedParts.slice(1), { text: '', thought: true }];
            const sent = [];
            t.mock.method(globalThis, 'fetch', async (input, init) => {
                const request = new Request(input, init);
                assert.equal(new URL(request.url).hostname, 'offline.invalid');
                sent.push(await request.json());
                const content = parts => ({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] });
                const chunks = sent.length === 1
                    ? (streaming ? rawParts.map(part => content([part])) : [content(rawParts)])
                    : [content([{ text: 'OK' }])];
                return new Response(streaming ? chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') : JSON.stringify(chunks[0]),
                    { headers: { 'Content-Type': streaming ? 'text/event-stream' : 'application/json' } });
            });
            const common = streaming ? { onStreamProgress() {} } : {};
            const user = { role: 'user', content: 'Inspect this card' };
            const adapter = createAgentAdapter(config);
            const first = await adapter.chat({ ...common, messages: [user] });
            assert.deepEqual(first.providerPayload.googleContents.flatMap(content => content.parts), preservedParts);
            const response = { ok: true, content: '' };
            await adapter.chat({ ...common, toolResponses: [{ ...first.toolCalls[0], response }] });

            const assistant = buildProviderAssistantToolCallMessage(first, first.toolCalls);
            // Also recover a previously saved turn containing both empty shapes.
            assistant.providerPayload.googleContents = [
                { role: 'model', parts: rawParts }, { role: 'model', parts: [{ text: '' }] },
            ];
            const result = buildProviderToolResultMessage({ toolCallId: first.toolCalls[0].id,
                toolName: 'ReadSkill', content: JSON.stringify(response) });
            await createAgentAdapter(config).chat({ ...common, messages: JSON.parse(JSON.stringify([user, assistant, result])) });
            for (const body of sent.slice(1)) {
                assert.deepEqual(body.contents.filter(content => content.role === 'model').flatMap(content => content.parts), preservedParts);
                assert.ok(body.contents.every(content => content.parts.length > 0));
                assert.deepEqual(body.contents.at(-1).parts, [{ functionResponse: { id: 'call_fixture', name: 'ReadSkill', response } }]);
            }
        });
    }
}
