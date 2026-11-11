import type { Change, Json, Path } from '../types.js';
import { getAt } from '../engine/data.js';

export interface ChangeTree<T> { path: Path; items: T[]; children: ChangeTree<T>[] }

/** Display-only grouping. Original changes and saved deltas stay untouched. */
export function changeTree<T extends { change: Change }>(items: T[], state: Json, path: Path = []): ChangeTree<T>[] {
    const leaves = items.filter(item => item.change.path.length === path.length);
    const groups = new Map<string, T[]>();
    for (const item of items) {
        if (item.change.path.length <= path.length) {continue;}
        const key = item.change.path[path.length];
        if (!groups.has(key)) {groups.set(key, []);}
        groups.get(key)!.push(item);
    }
    return [...leaves.map(item => ({ path, items: [item], children: [] })), ...[...groups].flatMap(([key, grouped]) => {
        const childPath = [...path, key], children = changeTree(grouped, state, childPath);
        if (children.length === 1) {return children;}
        // Flat scalar comparisons remain immediately readable. Additions and
        // removals may contain arbitrarily large inventory/log structures.
        if (grouped.some(item => item.change.before !== undefined && !item.change.removed)) {return children;}
        const current = getAt(state, childPath);
        // Do not wrap unchanged siblings in a broader "changed structure".
        // A removed structure is absent; an added one contains only added fields.
        if (current && typeof current === 'object' && (grouped.every(item => item.change.removed)
            || Object.keys(current).some(key => !grouped.some(item => item.change.path[childPath.length] === key)))) {return children;}
        return [{ path: childPath, items: grouped, children }];
    })];
}
