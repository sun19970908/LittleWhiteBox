import { create, type Delta, type DiffContext, type Filter, type Options } from 'jsondiffpatch';
import { clone } from './data.js';
import { encodeDeltaValue, decodeDeltaValue } from './delta-data.js';
import { digest } from '../definition/digest.js';
import type { Json } from '../types.js';

// Keep literal strings and reversible old values. No text patches or move records.
const options: Options = { arrays: { detectMove: false }, cloneDiffValues: true };
const anchors = create({ ...options, objectHash: digest });
const patcher = create(options);

/**
 * Array identity is content-based, not an invented id/name field. The library
 * finds unchanged anchors; unmatched containers between two anchors pair in
 * order so an edited object remains a field edit rather than remove + add.
 * All delta generation and index application still belong to jsondiffpatch.
 */
const matchContainers: Filter<DiffContext> = context => {
    if (!context.leftIsArray || !context.rightIsArray) {return;}
    const left = context.left as Json[], right = context.right as Json[];
    const aligned = anchors.diff(left, right);
    if (!aligned) {context.setResult(undefined).exit(); return;}
    const removed = new Set(Object.keys(aligned).filter(key => key.startsWith('_') && key !== '_t').map(key => Number(key.slice(1))));
    const added = new Set(Object.entries(aligned).filter(([key, delta]) => key !== '_t' && !key.startsWith('_') && Array.isArray(delta) && delta.length === 1).map(([key]) => Number(key)));
    const identities = new WeakMap<object, string>();
    let a = 0, b = 0;
    while (a < left.length || b < right.length) {
        const oldGap: number[] = [], newGap: number[] = [];
        while (removed.has(a)) {oldGap.push(a++);}
        while (added.has(b)) {newGap.push(b++);}
        for (let offset = 0; offset < Math.min(oldGap.length, newGap.length); offset++) {
            const oldIndex = oldGap[offset], newIndex = newGap[offset];
            const oldValue = left[oldIndex], newValue = right[newIndex];
            if (oldValue && newValue && typeof oldValue === 'object' && typeof newValue === 'object'
                && Array.isArray(oldValue) === Array.isArray(newValue)) {
                const identity = `edit:${oldIndex}:${newIndex}`;
                identities.set(oldValue, identity); identities.set(newValue, identity);
            }
        }
        if (a < left.length) {a++;}
        if (b < right.length) {b++;}
    }
    context.options = { ...options, objectHash: value => identities.get(value) ?? digest(value) };
};
matchContainers.filterName = 'state3ArrayIdentity';
patcher.processor.pipes.diff.before('arrays', matchContainers);

/** Persist the library format directly. null is a JSON-safe no-change delta. */
export type StoredDelta = Exclude<Delta, undefined> | null;
export const difference = (before: Json | undefined, after: Json | undefined): StoredDelta => patcher.diff(encodeDeltaValue(before), encodeDeltaValue(after)) ?? null;
export function applyDifference(state: Json, delta: StoredDelta, reverse = false): Json {
    const encoded = encodeDeltaValue(state), saved = clone(delta) ?? undefined;
    return decodeDeltaValue((reverse ? patcher.unpatch(encoded, saved) : patcher.patch(encoded, saved)) as Json) as Json;
}
