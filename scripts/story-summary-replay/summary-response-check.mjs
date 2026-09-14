import assert from 'node:assert/strict';
import { runSummaryGeneration } from '../../modules/story-summary/generate/generator.js';
import { getSummaryStore } from '../../modules/story-summary/data/store.js';
import { getContext, __setReplayContext } from './shims/extensions.js';
import { chat_metadata, __setChatMetadata } from './shims/script.js';

// Exercise the commit boundary: a syntactically valid non-object response must
// not silently consume source floors or throw during summary merging.
export async function runSummaryResponseCheck() {
    const previousContext = getContext();
    const previousMetadata = chat_metadata;
    const previousStreamingModule = globalThis.window.xiaobaixStreamingGeneration;
    const summary = id => ({
        events: [{ id, title: '回家', summary: '两人一起吃牛肉面',
            participants: [], causedBy: [], memoryRole: '具体经历' }],
        keywords: [], newCharacters: [], arcUpdates: [], factUpdates: [],
    });
    const nextSummary = JSON.stringify(summary('evt-2'));
    const invalid = [[], [summary('evt-2')], 'text', '{}', 42, true, false, null];
    const cases = [
        ...invalid.map(value => ({ raw: JSON.stringify(value), valid: false })),
        { raw: nextSummary, valid: true },
        { raw: `\`\`\`json\n${nextSummary}\n\`\`\``, valid: true },
        { raw: `总结如下：\n${nextSummary}`, valid: true },
    ];
    const config = { api: { provider: 'st' }, trigger: { useStream: false, delayFloors: 0 } };

    try {
        for (const [index, scenario] of cases.entries()) {
            const chatId = `summary-response-${index}`;
            const chat = [{ is_user: true, mes: '我拎着两碗牛肉面推开家门。' }];
            let saved = 0;
            let responseText = JSON.stringify(summary('evt-1'));
            __setChatMetadata({});
            __setReplayContext({ chatId, chat, saveMetadata: async () => { saved++; } });
            globalThis.window.xiaobaixStreamingGeneration = {
                async xbgenrawCommand() { return responseText; },
            };
            const seed = await runSummaryGeneration(0, config);
            assert.equal(seed.success, true);
            assert.equal(saved, 1);
            const before = structuredClone(getSummaryStore());
            saved = 0;
            chat.push({ is_user: false, mes: '小红接过碗，我们一起坐下。' });
            responseText = scenario.raw;
            let completed = false;
            const errors = [];
            const result = await runSummaryGeneration(1, config, {
                onError: message => errors.push(message),
                onComplete: () => { completed = true; },
            });

            assert.equal(result.success, scenario.valid, scenario.raw);
            assert.equal(completed, scenario.valid, scenario.raw);
            assert.equal(saved, scenario.valid ? 1 : 0, scenario.raw);
            if (scenario.valid) {
                assert.equal(errors.length, 0);
                assert.equal(getSummaryStore().lastSummarizedMesId, 1);
                assert.deepEqual(getSummaryStore().json.events.map(event => event.id), ['evt-1', 'evt-2']);
            } else {
                assert.equal(result.error, 'parse');
                assert.equal(errors.length, 1);
                assert.deepEqual(getSummaryStore(), before, scenario.raw);
            }
        }
        return { passed: cases.length };
    } finally {
        __setReplayContext(previousContext);
        __setChatMetadata(previousMetadata);
        globalThis.window.xiaobaixStreamingGeneration = previousStreamingModule;
    }
}
