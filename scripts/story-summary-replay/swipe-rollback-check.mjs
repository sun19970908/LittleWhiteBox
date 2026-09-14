import assert from 'node:assert/strict';
import { EXT_ID } from '../../core/constants.js';
import { buildSummaryUndo } from '../../modules/story-summary/data/summary-undo.js';
import { applySummaryPanelConfigSnapshot } from '../../modules/story-summary/data/config.js';
import { getSummaryStore, rollbackSummaryIfNeeded } from '../../modules/story-summary/data/store.js';
import { runSummaryGeneration } from '../../modules/story-summary/generate/generator.js';
import { getAllEventVectors, saveEventVectors } from '../../modules/story-summary/vector/storage/chunk-store.js';
import { getContext, __setReplayContext, __setExtensionSettings } from './shims/extensions.js';
import { __setChatMetadata } from './shims/script.js';

// Same-length source replacement must retract the affected batch, including L3.
// Repeated swipes of the same tail must not retract earlier, unaffected batches.
export async function runSwipeRollbackCheck() {
    const previousSaveMetadata = getContext().saveMetadata;
    const previousStreamingModule = globalThis.window.xiaobaixStreamingGeneration;
    const empty = { events: [], keywords: [], characters: { main: [] }, arcs: [], facts: [], characterAliases: [] };
    const event = (id, end) => ({ id, title: id, summary: `旧剧情 ${id}`, _addedAt: end,
        participants: [], causedBy: [], memoryRole: '具体经历' });
    const first = { ...structuredClone(empty), events: [event('evt-1', 19)],
        facts: [{ id: 'f-1', s: '角色', p: '位置', o: '家', since: 19, _addedAt: 19 }] };
    const second = { ...structuredClone(first), events: [...first.events, event('evt-2', 39)],
        facts: [{ ...first.facts[0], o: '车站', since: 39, _addedAt: 39 }] };
    const cases = [
        { name: 'protected-tail', length: 42, deleted: 0, expected: 39 },
        { name: 'delete-one', length: 42, deleted: 1, expected: 39 },
        { name: 'delete-two', length: 42, deleted: 2, expected: 19, rolledBackBySwipe: true },
        { name: 'delete-three', length: 42, deleted: 3, expected: 19 },
        { name: 'additional-unsummarized-tail', length: 46, deleted: 2, expected: 39 },
        { name: 'explicit-earlier-floor', length: 42, deleted: 0, floor: 25, expected: 19, rolledBackBySwipe: true },
    ];
    try {
        for (const scenario of cases) {
            const chatId = `swipe-rollback-${scenario.name}`;
            const chat = Array.from({ length: scenario.length }, (_, index) => ({
                mes: `正文 ${index + 1}`, is_user: index % 2 === 0,
            }));
            let writes = 0;
            let modelCalls = 0;
            __setExtensionSettings({ [EXT_ID]: { storySummary: { enabled: true } } });
            __setReplayContext({ chatId, chat, saveMetadata: async () => { writes++; } });
            __setChatMetadata({ extensions: { [EXT_ID]: { storySummary: {
                json: structuredClone(second), lastSummarizedMesId: 39,
                summaryHistory: [
                    { format: 1, previousEndMesId: -1, endMesId: 19, undo: buildSummaryUndo(empty, first) },
                    { format: 1, previousEndMesId: 19, endMesId: 39, undo: buildSummaryUndo(first, second) },
                ],
            } } } });
            const store = getSummaryStore();
            await saveEventVectors(chatId, [
                { eventId: 'evt-1', vector: [1, 0] }, { eventId: 'evt-2', vector: [0, 1] },
            ], 'test');
            globalThis.window.xiaobaixStreamingGeneration = {
                async xbgenrawCommand() {
                    modelCalls++;
                    return JSON.stringify({ keywords: [], events: [], newCharacters: [], arcUpdates: [], factUpdates: [] });
                },
                cancel() {},
            };

            chat.splice(chat.length - scenario.deleted);
            const deletion = await rollbackSummaryIfNeeded();
            assert.equal(deletion.status, scenario.deleted === 3 ? 'rolled_back' : 'not_needed', scenario.name);
            const floor = scenario.floor ?? chat.length - 1;
            const writesBeforeSwipe = writes;
            chat[floor].mes = '换成另一个版本的剧情';
            const swipeResult = await rollbackSummaryIfNeeded({ changedFromFloor: floor });
            assert.equal(swipeResult.status, scenario.rolledBackBySwipe ? 'rolled_back' : 'not_needed', scenario.name);
            assert.equal(writes - writesBeforeSwipe, scenario.rolledBackBySwipe ? 1 : 0, scenario.name);
            assert.equal(store.lastSummarizedMesId, scenario.expected, scenario.name);
            assert.equal(store.json.facts[0].o, scenario.expected === 19 ? '家' : '车站', scenario.name);
            const expectedEvents = scenario.expected === 19 ? ['evt-1'] : ['evt-1', 'evt-2'];
            assert.deepEqual(store.json.events.map(item => item.id), expectedEvents, scenario.name);
            assert.deepEqual((await getAllEventVectors(chatId)).map(item => item.eventId), expectedEvents, scenario.name);

            const writesAfterSwipe = writes;
            for (let attempt = 0; attempt < 3; attempt++) {
                chat[floor].mes = `再换版本 ${attempt}`;
                assert.equal((await rollbackSummaryIfNeeded({ changedFromFloor: floor })).status, 'not_needed');
            }
            assert.equal(writes, writesAfterSwipe, 'repeated swipe does not roll back another batch');
            assert.equal(modelCalls, 0, 'rollback itself must not call the model');

            if (scenario.name === 'delete-two') {
                const config = applySummaryPanelConfigSnapshot({ trigger: { useStream: false } });
                assert.equal(config.trigger.delayFloors, 2);
                assert.ok(chat.length - 1 - config.trigger.delayFloors - store.lastSummarizedMesId < config.trigger.interval,
                    'this rollback does not immediately meet the default automatic summary interval');
                // Even an explicit manual summary must leave the current tail out.
                const result = await runSummaryGeneration(chat.length - 1, config, {}, { targetChatId: chatId });
                assert.equal(result.success, true);
                assert.equal(store.lastSummarizedMesId, 37);
                assert.equal(modelCalls, 1);
                chat[floor].mes = '手动总结后再 swipe';
                assert.equal((await rollbackSummaryIfNeeded({ changedFromFloor: floor })).status, 'not_needed');
                assert.equal(modelCalls, 1);
            }
        }
        return { cases: cases.length };
    } finally {
        __setReplayContext({ saveMetadata: previousSaveMetadata });
        globalThis.window.xiaobaixStreamingGeneration = previousStreamingModule;
    }
}
