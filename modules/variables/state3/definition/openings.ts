import type { Definition, Json, JsonObject } from '../types.js';
import { clone } from '../engine/data.js';
import { reject } from '../engine/diagnostics.js';

const object = (value: Json | undefined): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
function overlay(base: Json | undefined, value: Json): Json {
    if (!object(value)) {return clone(value);}
    const result = object(base) ? clone(base) : {};
    for (const [key, child] of Object.entries(value)) {result[key] = overlay(result[key], child);}
    return result;
}

/** Greeting order selects data only; every opening uses the same compiled rules. */
export function initialState(definition: Definition, swipeId = 0, base: JsonObject = definition.initial): JsonObject {
    if (!Number.isSafeInteger(swipeId) || swipeId < 0) {reject('opening-index', { opening: swipeId });}
    return overlay(base, definition.openings?.[swipeId] ?? {}) as JsonObject;
}
