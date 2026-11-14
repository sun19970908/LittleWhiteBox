import { contains } from '../engine/data.js';
import { DIRECT_INPUTS } from '../engine/input.js';
import type { Compiled, JsonObject, Path, UpdateStage } from '../types.js';
import { allowsStage, canWriteDirect } from '../definition/stages.js';
import type { AgentToolDefinition } from '../../../agent-core/public-api.js';

export const SUBMIT_TOOL = 'write';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const blockedPaths = (compiled: Compiled, stage?: UpdateStage) => [
    ...compiled.definition.access.filter(entry => !entry.direct || !allowsStage(compiled.definition, entry, stage)).map(entry => entry.path),
    ...compiled.rules.filter(rule => rule.kind === 'derive').map(rule => rule.path),
];

/** A finite tool projection of action parameters; the full schema stays in the writing guide and final validator. */
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
export interface WritableField { path: Path; removable: boolean; descriptions: string[] }
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
export function getWritableFields(compiled: Compiled, stage?: UpdateStage): WritableField[] {
    const fields: WritableField[] = [];
    const visit = (raw: unknown, path: Path, required: boolean) => {
        if (path.length && canWriteDirect(compiled.definition, path, stage)) {fields.push({ path, removable: !required, descriptions: compiled.definition.access.filter(entry => contains(entry.path, path)).map(entry => entry.description) });}
        if (!object(raw) || !object(raw.properties)) {return;}
        for (const [key, schema] of Object.entries(raw.properties)) {visit(schema, [...path, key], Array.isArray(raw.required) && raw.required.includes(key));}
    };
    visit(compiled.definition.schema, [], true);
    return fields;
}
export function getInputSchema(compiled: Compiled, stage?: UpdateStage): JsonObject {
    const operations: JsonObject[] = [];
    for (const access of compiled.definition.access.filter(entry => entry.direct && allowsStage(compiled.definition, entry, stage))) {
        const blocked = blockedPaths(compiled, stage);
        if (blocked.some(path => contains(path, access.path))) {continue;}
        let schema: unknown = compiled.definition.schema;
        for (const segment of access.path) {schema = object(schema) && object(schema.properties) ? schema.properties[segment] : undefined;}
        const candidates = finitePaths(schema, access.path)?.filter(path => canWriteDirect(compiled.definition, path, stage));
        if (candidates?.length === 0) {continue;}
        // Tool providers may reject array-valued enums and tuple/prefix schemas.
        // Keep the path shape here; settlement enforces the full permissions.
        const path: JsonObject = { type: 'array', items: { type: 'string' }, minItems: Math.max(1, access.path.length),
            description: `Field-name segments within ${JSON.stringify(access.path)}. ${access.description}` };
        for (const [op, input] of Object.entries(DIRECT_INPUTS)) {
            operations.push({ type: 'object', description: input.description, required: ['op', 'path', ...Object.keys(input.parameters)],
                properties: { op: { const: op }, path, ...input.parameters,
                    reason: { type: 'string' }, old: {} }, additionalProperties: true });
        }
    }
    for (const action of compiled.definition.actions.filter(action => allowsStage(compiled.definition, action, stage))) {
        operations.push({ type: 'object', required: ['action', 'params'], properties: {
            action: { const: action.id, description: action.description },
            params: inline(action.parameters, action.parameters) as JsonObject,
            reason: { type: 'string' }, old: {},
        }, additionalProperties: true });
    }
    return { type: 'array', items: operations.length ? { anyOf: operations } : false };
}
export function getTools(compiled: Compiled, stage?: UpdateStage): AgentToolDefinition[] {
    return [{ type: 'function', function: { name: SUBMIT_TOOL,
        description: 'Submit one ordered batch of changes and actions caused by the marked passage. The platform validates and saves them to that passage, then ends this request without a tool-result turn. A rejected batch applies none of its items and returns its diagnostics for one corrected submission. An empty state array records that this passage causes no changes.',
        parameters: { type: 'object', required: ['state'], additionalProperties: false, properties: { state: getInputSchema(compiled, stage) } },
    } }];
}
