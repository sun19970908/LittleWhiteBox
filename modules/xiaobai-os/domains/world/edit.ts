import { parseWorldContent, parseWorldNews, record, WorldValidationError, worldText } from './invariants.js';
import { sameWorldContent, WORLD_LIMITS, type WorldContent } from './types.js';

export interface WorldEditResult {
    ok: boolean;
    status: 'updated' | 'unchanged' | 'failed';
    changed: boolean;
    data: WorldContent;
    errors: { path: string; message: string }[];
}

export function editWorld(current: WorldContent, input: unknown): WorldEditResult {
    try {
        const edit = record(input, 'WorldEdit', ['overview', 'upsert', 'remove']);
        const overview = 'overview' in edit
            ? worldText(edit.overview, 'WorldEdit.overview', WORLD_LIMITS.overview, true) : current.overview;
        const list = (key: 'upsert' | 'remove'): unknown[] => {
            if (!(key in edit)) { return []; }
            if (!Array.isArray(edit[key]) || edit[key].length > WORLD_LIMITS.news) {
                throw new WorldValidationError(`WorldEdit.${key}`, `Expected up to ${WORLD_LIMITS.news} items.`);
            }
            return edit[key];
        };
        const upsert = list('upsert').map((item, i) => parseWorldNews(item, `WorldEdit.upsert[${i}]`));
        const remove = list('remove').map((id, i) => worldText(id, `WorldEdit.remove[${i}]`, WORLD_LIMITS.id));
        const ids = [...upsert.map(item => item.id), ...remove];
        if (new Set(ids).size !== ids.length) {
            throw new WorldValidationError('WorldEdit', 'Each ID may appear once per edit, in either upsert or remove.');
        }
        const replacements = new Map(upsert.map(item => [item.id, item]));
        const oldIds = new Set(current.news.map(item => item.id));
        const data = parseWorldContent({ overview, news: [
            ...upsert.filter(item => !oldIds.has(item.id)),
            ...current.news.filter(item => !remove.includes(item.id)).map(item => replacements.get(item.id) ?? item),
        ] });
        const changed = !sameWorldContent(current, data);
        return { ok: true, status: changed ? 'updated' : 'unchanged', changed, data, errors: [] };
    } catch (error) {
        if (!(error instanceof WorldValidationError)) { throw error; }
        return { ok: false, status: 'failed', changed: false, data: structuredClone(current),
            errors: [{ path: error.path, message: error.message }] };
    }
}
