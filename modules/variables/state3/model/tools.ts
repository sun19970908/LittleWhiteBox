import { contains, overlaps } from '../engine/data.js';
import type { Compiled, JsonObject, Path, Schema } from '../types.js';
import type { AgentToolDefinition } from '../../../agent-core/public-api.js';

export const SUBMIT_TOOL = 'write';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const blockedPaths = (compiled: Compiled) => [
    ...compiled.definition.access.filter(entry => !entry.write.includes('direct')).map(entry => entry.path),
    ...compiled.rules.filter(rule => rule.kind === 'derive').map(rule => rule.path),
];
function direct(compiled: Compiled, path: Path): boolean {
    return compiled.definition.access.some(entry => entry.write.includes('direct') && contains(entry.path, path))
        && !blockedPaths(compiled).some(blocked => overlaps(blocked, path));
}

/** A finite tool projection; full recursive/conditional schemas stay in the writing guide and final validator. */
function inline(raw: unknown, root: unknown, seen = new Set<string>()): unknown {
    if (Array.isArray(raw)) {return raw.map(value => inline(value, root, seen));}
    if (!object(raw)) {return raw;}
    if (typeof raw.$ref === 'string' && raw.$ref.startsWith('#')) {
        if (seen.has(raw.$ref)) {return {};}
        let value: unknown = root;
        for (const part of raw.$ref.slice(2).split('/').filter(Boolean).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'))) {
            value = object(value) ? value[part] : undefined;
        }
        const resolved = inline(value, root, new Set([...seen, raw.$ref]));
        const siblings = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== '$ref'));
        return Object.keys(siblings).length ? { allOf: [resolved, inline(siblings, root, seen)] } : resolved;
    }
    return Object.fromEntries(Object.entries(raw).filter(([key]) => !['$id', '$schema', '$defs', 'definitions'].includes(key))
        .map(([key, value]) => [key, inline(value, root, seen)]));
}
export interface WritableField { path: Path; schema: Schema; removable: boolean; descriptions: string[] }
function finitePaths(raw: unknown, path: Path): Path[] | undefined {
    if (!object(raw) || raw.$ref || ['allOf', 'anyOf', 'oneOf', 'if', 'patternProperties'].some(key => key in raw)) {return undefined;}
    if (raw.type === 'array' || !raw.type) {return undefined;}
    if (raw.type !== 'object') {return [path];}
    if (raw.additionalProperties !== false) {return undefined;}
    const paths = [path];
    for (const [key, value] of Object.entries(object(raw.properties) ? raw.properties : {})) {
        const children = finitePaths(value, [...path, key]);
        if (!children) {return undefined;}
        paths.push(...children);
    }
    return paths;
}
export function getWritableFields(compiled: Compiled): { fields: WritableField[]; diagnostics: [] } {
    const fields: WritableField[] = [];
    const visit = (raw: unknown, path: Path, required: boolean) => {
        if (path.length && direct(compiled, path)) {fields.push({ path, schema: (inline(raw, compiled.definition.schema) ?? {}) as Schema,
            removable: !required, descriptions: compiled.definition.access.filter(entry => contains(entry.path, path)).map(entry => entry.description) });}
        if (!object(raw) || !object(raw.properties)) {return;}
        for (const [key, schema] of Object.entries(raw.properties)) {visit(schema, [...path, key], Array.isArray(raw.required) && raw.required.includes(key));}
    };
    visit(compiled.definition.schema, [], true);
    return { fields, diagnostics: [] };
}
export function getInputSchema(compiled: Compiled): JsonObject {
    const operations: JsonObject[] = [];
    for (const access of compiled.definition.access.filter(entry => entry.write.includes('direct'))) {
        const blocked = blockedPaths(compiled);
        if (blocked.some(path => contains(path, access.path))) {continue;}
        let schema: unknown = compiled.definition.schema;
        for (const segment of access.path) {schema = object(schema) && object(schema.properties) ? schema.properties[segment] : undefined;}
        const candidates = finitePaths(schema, access.path)?.filter(path => direct(compiled, path));
        if (candidates?.length === 0) {continue;}
        // Tool providers do not share Ajv's tuple/prefix schema support. Closed
        // paths are enumerable; dynamic paths keep their array shape and the
        // same final settlement permissions, without blocking the whole card.
        const path: JsonObject = { type: 'array', items: { type: 'string' }, minItems: Math.max(1, access.path.length),
            ...(candidates ? { enum: candidates } : { description: `Field-name segments within ${JSON.stringify(access.path)}. ${access.description}` }) };
        for (const op of ['set', 'remove']) {
            operations.push({ type: 'object', required: op === 'set' ? ['op', 'path', 'value'] : ['op', 'path'],
                properties: { op: { const: op }, path, ...(op === 'set' ? { value: {} } : {}),
                    reason: { type: 'string' }, old: {} }, additionalProperties: true });
        }
    }
    for (const action of compiled.definition.actions) {
        operations.push({ type: 'object', required: ['action', 'params'], properties: {
            action: { const: action.id, description: action.description },
            params: inline(action.parameters, action.parameters) as JsonObject,
            reason: { type: 'string' }, old: {},
        }, additionalProperties: true });
    }
    return { type: 'array', items: operations.length ? { anyOf: operations } : false };
}
export function getTools(compiled: Compiled): AgentToolDefinition[] {
    return [{ type: 'function', function: { name: SUBMIT_TOOL,
        description: 'Submit one ordered batch of changes and actions for the marked passage. The result reports confirmed changes or diagnostics; failure applies none of the batch. An empty state array records that this passage causes no changes.',
        parameters: { type: 'object', required: ['state'], additionalProperties: false, properties: { state: getInputSchema(compiled) } },
    } }];
}
