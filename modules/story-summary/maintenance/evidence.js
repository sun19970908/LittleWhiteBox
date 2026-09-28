import { requireMemory } from './errors.js';
import { sameMemory } from './domain.js';
import { applyTextFilterRules } from '../data/text-filter-rules.js';

export const SOURCE_PAGE_CHARS = 10000;
const sourceRecord = (message, index) => ({
    floor: index + 1, name: String(message?.name || ''), role: message?.is_user ? 'user' : 'assistant',
    text: String(message?.mes || ''), swipe: message?.swipe_id ?? null,
});

/** Source stays read-only. Supplied ranges are host observations, not per-edit citations. */
export function createEvidenceReader(chat, cutoff, filterRules = []) {
    requireMemory(Number.isInteger(cutoff) && cutoff >= 0 && cutoff < chat.length, 'source_boundary');
    const snapshot = chat.slice(0, cutoff + 1).map(sourceRecord);
    const inspected = new Set(), prepared = [];
    let supplied = 0;
    const story = snapshot.map(record => applyTextFilterRules(record.text, filterRules));
    return {
        cutoff, source: snapshot, story,
        inputProvided() { supplied = prepared.length; },
        ranges: () => structuredClone(prepared.slice(0, supplied)),
        read({ floor, offset = 0, view = 'story', limit = SOURCE_PAGE_CHARS } = {}) {
            requireMemory(Number.isInteger(floor) && floor >= 1 && floor <= cutoff + 1, 'source_boundary', '', 'floor');
            requireMemory(Number.isInteger(offset) && offset >= 0 && ['story', 'raw'].includes(view)
                && Number.isInteger(limit) && limit >= 0, 'invalid_arguments', '', 'offset');
            const record = snapshot[floor - 1], text = view === 'raw' ? record.text : story[floor - 1];
            requireMemory(offset <= text.length, 'invalid_arguments', '', 'offset');
            const end = Math.min(text.length, offset + limit);
            inspected.add(floor);
            prepared.push({ floor, start: offset, end, view });
            return { floor, name: record.name, role: record.role, view, text: text.slice(offset, end),
                excludedCharacters: record.text.length - story[floor - 1].length,
                next: end < text.length ? { floor, offset: end, view } : floor < cutoff + 1 ? { floor: floor + 1, offset: 0, view } : null,
                complete: end === text.length };
        },
        search({ query, from = 1, limit = 20 } = {}) {
            requireMemory(typeof query === 'string' && query.trim(), 'invalid_arguments', '', 'query');
            requireMemory(Number.isInteger(from) && from >= 1 && from <= cutoff + 1, 'source_boundary', '', 'from');
            requireMemory(Number.isInteger(limit) && limit >= 1 && limit <= 20, 'invalid_arguments', '', 'limit');
            const hits = [];
            let floor = from;
            for (; floor <= cutoff + 1; floor++) {
                inspected.add(floor);
                const record = snapshot[floor - 1], text = story[floor - 1];
                const at = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
                if (at >= 0) {
                    const start = Math.max(0, at - 80), end = Math.min(text.length, at + 240);
                    hits.push({ floor, name: record.name, role: record.role, excerpt: text.slice(start, end) });
                    prepared.push({ floor, start, end, view: 'story' });
                }
                if (hits.length >= limit) { floor++; break; }
            }
            return { hits, next: floor <= cutoff + 1 ? floor : null };
        },
        assertCurrent(currentChat, all = false) {
            for (const floor of all ? snapshot.map(record => record.floor) : inspected) requireMemory(sameMemory(snapshot[floor - 1], sourceRecord(currentChat[floor - 1], floor - 1)), 'conflict');
        },
    };
}
