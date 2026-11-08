import type { Json } from '../types.js';

/**
 * jsondiffpatch reserves _t inside deltas. Prefix every object key at its
 * boundary, including numeric and already-prefixed keys. Array indices and
 * string values are untouched; decoding is exact, not a JSON/text heuristic.
 */
export const deltaKey = (key: string) => '~' + key;
export const valueKey = (key: string) => key.slice(1);
function mapKeys(value: Json | undefined, key: (name: string) => string): Json | undefined {
    if (Array.isArray(value)) {return value.map(item => mapKeys(item, key) as Json);}
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [key(name), mapKeys(item, key) as Json]));
    }
    return value;
}
export const encodeDeltaValue = (value: Json | undefined) => mapKeys(value, deltaKey);
export const decodeDeltaValue = (value: Json | undefined) => mapKeys(value, valueKey);
