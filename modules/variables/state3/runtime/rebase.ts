import { create, type Delta, type Filter, type PatchContext, type ArrayDelta } from 'jsondiffpatch';
import { clone } from '../engine/data.js';
import { encodeDeltaValue, decodeDeltaValue } from '../engine/delta-data.js';
import type { StoredDelta } from '../engine/difference.js';
import type { Json } from '../types.js';

// Ordinary restore never uses this policy. It only applies already-confirmed
// later effects to a changed predecessor; rules/actions are not executed.
const patcher = create();
function writesValue(delta: Delta): boolean {
    if (!delta) {return false;}
    if (Array.isArray(delta)) {return delta.length < 3;}
    return Object.entries(delta).some(([key, child]) => key !== '_t' && writesValue(child));
}

const retainParents: Filter<PatchContext> = context => {
    const delta = context.delta;
    if (!delta || Array.isArray(delta) || context.children) {return;}
    const array = delta._t === 'a';
    if (context.left === null || typeof context.left !== 'object' || Array.isArray(context.left) !== array) {
        if (!writesValue(delta)) {context.setResult(context.left).exit(); return;}
        context.left = array ? [] : {};
    }
    if (!array) {return;}
    const value = context.left as Json[], edits = delta as ArrayDelta;
    // Removing an absent position has no effect. Do not create old contents to
    // delete them, and do not let padding turn an absent removal into a real one.
    const present = Object.entries(edits).filter(([key]) => !key.startsWith('_') || key === '_t' || Number(key.slice(1)) < value.length);
    const removals = present.filter(([key]) => key.startsWith('_') && key !== '_t').length;
    const additions = present.filter(([key, item]) => !key.startsWith('_') && Array.isArray(item) && item.length === 1)
        .map(([key]) => Number(key)).sort((a, b) => a - b);
    const modifications = present.filter(([key, item]) => !key.startsWith('_') && !(Array.isArray(item) && item.length === 1) && writesValue(item)).map(([key]) => Number(key));
    // Reserve only the null slots needed to retain final positions. The library
    // owns removal/insertion order and passes each nested node its actual value.
    let needed = value.length - removals;
    additions.forEach((index, offset) => {needed = Math.max(needed, index - offset);});
    modifications.forEach(index => {needed = Math.max(needed, index + 1 - additions.length);});
    while (value.length < needed + removals) {value.push(null);}
    // Child patches run after structural edits. Skip absent pure deletions so
    // the library's child collector cannot extend the array with undefined.
    const finalLength = needed + additions.length;
    context.delta = Object.fromEntries(present.filter(([key, item]) => key.startsWith('_') || Number(key) < finalLength || writesValue(item))) as ArrayDelta;
};
retainParents.filterName = 'state3RetainParents';
patcher.processor.pipes.patch.prepend(retainParents);

export function retainEffects(state: Json, delta: StoredDelta): Json {
    return decodeDeltaValue(patcher.patch(encodeDeltaValue(state), clone(delta) ?? undefined) as Json) as Json;
}
