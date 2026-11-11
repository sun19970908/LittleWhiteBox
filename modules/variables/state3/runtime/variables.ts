import type { Definition, History, Json, JsonObject } from '../types.js';
import { tryParseJson } from '../../../../shared/common/json-candidate.js';
import { clone } from '../engine/data.js';
import { CHAT_KEY } from '../definition/format.js';

/** The definition owns named native roots, never the whole chat variable bag. */
export function variableRoots(definition: Definition): string[] {
    return Object.keys(definition.initial);
}

export function readVariables(variables: Record<string, unknown>, roots = Object.keys(variables)): JsonObject {
    return Object.fromEntries(roots.filter(root => Object.hasOwn(variables, root)).map(root => {
        let value = variables[root];
        if (typeof value === 'string') {
            const parsed = tryParseJson(value);
            if (parsed.ok) {value = parsed.value;}
        }
        return [root, clone(value) as Json];
    }));
}

export function writeVariables(variables: Record<string, unknown>, state: JsonObject, roots: string[]): void {
    for (const root of roots) {
        if (!Object.hasOwn(state, root)) { delete variables[root]; continue; }
        const value = state[root];
        variables[root] = typeof value === 'number' ? value : JSON.stringify(value);
    }
}

/** Owned roots use one JSON decode; strings that look like JSON stay strings. */
export function ownsVariable(metadata: Record<string, unknown>, root: string): boolean {
    return Boolean((metadata[CHAT_KEY] as History | undefined)?.roots.includes(root));
}
export function readOwnedVariable(metadata: Record<string, unknown>, root: string): Json | undefined {
    return readVariables((metadata.variables || {}) as Record<string, unknown>, [root])[root];
}
export function writeOwnedVariable(metadata: Record<string, unknown>, root: string, value: Json): void {
    metadata.variables ??= {};
    writeVariables(metadata.variables as Record<string, unknown>, { [root]: value }, [root]);
}
