import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

export async function runSummaryRequestCheck() {
    const { generateSummary, parseSummaryJson } = await import('../../modules/story-summary/generate/llm.js');
    const originalFetch = globalThis.fetch;
    const originalStreamingModule = globalThis.window.xiaobaixStreamingGeneration;
    const summary = { events: [], facts: [], characters: { main: [] }, arcs: [], keywords: [] };
    const responseText = JSON.stringify(summary);
    const requests = [];
    const decodeMessages = value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

    // Capture the two outgoing transport boundaries without calling a model.
    globalThis.fetch = async (_url, options) => {
        const body = JSON.parse(options.body);
        requests.push({ messages: body.messages, stream: body.stream });
        if (body.stream) {
            const chunk = JSON.stringify({ choices: [{ delta: { content: responseText } }] });
            return new Response(`data: ${chunk}\n\ndata: [DONE]\n\n`, {
                headers: { 'Content-Type': 'text/event-stream' },
            });
        }
        return Response.json({ choices: [{ message: { content: responseText } }] });
    };
    globalThis.window.xiaobaixStreamingGeneration = {
        async xbgenrawCommand(args) {
            const messages = [...decodeMessages(args.top64), ...decodeMessages(args.bottom64)];
            for (const [key, role] of [['bottomsys', 'system'], ['bottomuser', 'user'], ['bottomassistant', 'assistant']]) {
                if (args[key]) messages.push({ role, content: args[key] });
            }
            const stream = args.nonstream !== 'true';
            requests.push({ messages, stream });
            return stream ? args.id : responseText;
        },
        getStatus() {
            return { isStreaming: false, text: responseText };
        },
    };

    const routes = [
        { provider: 'openai', model: 'claude-sonnet-4-6' },
        { provider: 'openai', model: 'gemini-2.5-pro' },
        { provider: 'custom', model: 'test-model' },
        { provider: 'st' },
        { provider: 'claude', model: 'claude-sonnet-4-6' },
        { provider: 'google', model: 'gemini-2.5-pro' },
    ];
    let baselineMessages;
    try {
        for (const route of routes) {
            for (const useStream of [false, true]) {
                const label = `${route.provider}/${route.model || 'host'} stream=${useStream}`;
                const requestCount = requests.length;
                const output = await generateSummary({
                    existingSummary: '两人刚搬入新家。',
                    existingFacts: [],
                    newHistoryText: '#1 【用户】\n我拎着两碗牛肉面推开家门。',
                    historyRange: '1-1楼',
                    nextEventId: 1,
                    existingEventCount: 0,
                    llmApi: { ...route, url: 'https://summary-test.invalid/v1' },
                    useStream,
                });
                assert.equal(requests.length, requestCount + 1, `${label}: one request`);
                const request = requests.at(-1);
                assert.equal(request.stream, useStream, label);
                assert.equal(request.messages.at(-1).role, 'user', `${label}: final instruction is user`);
                assert.ok(request.messages.at(-1).content.trim(), `${label}: final instruction is present`);
                baselineMessages ??= request.messages;
                assert.deepEqual(request.messages, baselineMessages, `${label}: identical prompt across transports`);
                assert.equal(output, responseText, `${label}: response has no synthetic prefill`);
                assert.deepEqual(parseSummaryJson(output), summary, `${label}: complete JSON remains parseable`);
            }
        }
        return { passed: requests.length };
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.window.xiaobaixStreamingGeneration = originalStreamingModule;
    }
}
