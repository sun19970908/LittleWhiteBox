import { MEMORY_COLLECTIONS } from './domain.js';
import { estimateConversationTokens, estimateTokenCount } from '../../agent-core/runtime/context-tokens.js';
import { selectMemoryRanges, unionRanges } from './ranges.js';
import { recordHandle } from './records.js';

/** Reading cursors, not work packages. The full request is counted before delivery. */
export function buildMemoryOpening({ task, records, maxTokens }) {
    const ranges = unionRanges([...task.pending, ...task.contextRanges]);
    records = selectMemoryRanges(records, ranges);
    const opening = { task, memory: [], memoryDirectory: MEMORY_COLLECTIONS.map(collection => ({
        collection, total: records.filter(record => record.collection === collection).length,
        next: records.some(record => record.collection === collection) ? { collection, ranges } : null,
    })) };
    const estimate = () => estimateConversationTokens({ messages: [{ role: 'user', content: JSON.stringify(opening) }] });
    let tokens = estimate();
    for (const collection of ['facts', 'events', 'anchors', 'characters', 'arcs', 'keywords', 'characterAliases']) {
        const directory = opening.memoryDirectory.find(item => item.collection === collection);
        const items = records.filter(item => item.collection === collection);
        let cursor;
        for (const record of items) {
            const size = estimateTokenCount(JSON.stringify(JSON.stringify(record)));
            if (tokens + size + 100 > maxTokens) {
                directory.next = { collection, ranges, ...(cursor ? { cursor } : {}) };
                break;
            }
            opening.memory.push(record); tokens += size;
            cursor = recordHandle(record);
            directory.next = record === items.at(-1) ? null : { collection, ranges, cursor };
        }
    }
    // Include the actual cursors and serialized message envelope, not just record text.
    while (opening.memory.length && estimate() > maxTokens) {
        const removed = opening.memory.pop();
        const directory = opening.memoryDirectory.find(item => item.collection === removed.collection);
        const previous = opening.memory.filter(item => item.collection === removed.collection).at(-1);
        directory.next = { collection: removed.collection, ranges, ...(previous ? { cursor: recordHandle(previous) } : {}) };
    }
    return opening;
}
