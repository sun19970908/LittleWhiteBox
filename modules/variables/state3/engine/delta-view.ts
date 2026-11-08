import { decodeDeltaValue, valueKey } from './delta-data.js';
import type { StoredDelta } from './difference.js';
import type { Change, Json, Path } from '../types.js';

/** One-way presentation of the library delta; never used for persistence/replay. */
export function displayChanges(delta: StoredDelta, path: Path = []): Change[] {
    if (!delta) {return [];}
    if (!Array.isArray(delta)) {
        const array = delta._t === 'a', entries = Object.entries(delta).filter(([key]) => !array || key !== '_t');
        const added = entries.filter(([key, child]) => array && !key.startsWith('_') && Array.isArray(child) && child.length === 1);
        const removed = new Map(entries.filter(([key]) => array && key.startsWith('_')).map(([key, child]) => [key.slice(1), child]));
        // Equal index sets have no intervening shift: show a replacement once.
        // Other insertions/removals retain their original index and direction.
        const replacements = added.length > 0 && added.length === removed.size && added.every(([key]) => removed.has(key));
        return entries.flatMap(([key, child]) => {
            if (replacements && key.startsWith('_')) {return [];}
            const shown = replacements && Array.isArray(child) && child.length === 1
                ? [(removed.get(key) as unknown[])[0], child[0]] : child;
            return displayChanges(shown as StoredDelta, [...path, array ? key.startsWith('_') ? key.slice(1) : key : valueKey(key)]);
        });
    }
    const before = delta.length === 1 ? undefined : decodeDeltaValue(delta[0] as Json);
    const after = delta.length === 3 ? undefined : decodeDeltaValue(delta.at(-1) as Json);
    const one = before === undefined ? after : after === undefined ? before : undefined;
    if (one !== null && typeof one === 'object' && Object.keys(one).length) {
        const leaves = (value: Json, current: Path): Change[] => {
            if (value !== null && typeof value === 'object' && Object.keys(value).length) {
                return Object.entries(value).flatMap(([key, item]) => leaves(item, [...current, key]));
            }
            return [{ path: current, ...(before === undefined ? { after: value } : { before: value }), removed: after === undefined }];
        };
        return leaves(one, path);
    }
    return [{ path, ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }), removed: after === undefined }];
}

