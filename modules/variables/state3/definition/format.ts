export const FORMAT = 1;
export const CARD_EXTENSION = 'lwb-state3';
export const CHAT_KEY = 'lwb-state3';
export const DEFINITION_FILE = 'variables/definition.json';
export const FUNCTION_DIRECTORY = 'variables/functions/';
export const TOOL_DIRECTORY = 'variables/tools/';
export const SCRIPT_DIRECTORY = 'variables/scripts/';
export const SCRIPT_PHASES = ['prepare', 'calculate', 'committed'] as const;

const path = { type: 'array', minItems: 1, items: { type: 'string' } };
const expression = { $ref: '#/$defs/expression' };
const named = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: ['id', ...Object.keys(properties)], properties: { id: { type: 'string', minLength: 1 }, ...properties } });
const effect = { type: 'object', additionalProperties: false, required: ['path', 'value'], properties: { path, value: expression } };
const description = { type: 'string', minLength: 1 };
const stages = { type: 'array', minItems: 1, uniqueItems: true, items: { enum: ['before', 'after'] } };
const extensionProperties = { title: description, description, enabled: { type: 'boolean' } };
const script = { type: 'object', additionalProperties: false, required: Object.keys(extensionProperties), properties: extensionProperties };
const action = named({ title: description, parameters: { type: 'object' }, description, requires: expression,
    effects: { type: 'array', minItems: 1, items: effect }, conversions: { type: 'array', items: effect } });
export const definitionSchema = {
    type: 'object', additionalProperties: false,
    required: ['format', 'name', 'updates', 'schema', 'initial', 'access', 'rules', 'actions', 'constraints', 'functions', 'views'],
    properties: {
        format: { const: FORMAT }, name: description, updates: stages, schema: { type: 'object' }, initial: { type: 'object' },
        openings: { type: 'array', items: { type: 'object' } },
        access: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'direct', 'description'], properties: { path, direct: { type: 'boolean' }, stages, description, update: description } } },
        rules: { type: 'array', items: named({ kind: { enum: ['derive', 'correct'] }, path, value: expression, description }) },
        actions: { type: 'array', items: { ...action, properties: { ...action.properties, stages } } },
        triggers: { type: 'array', items: {
            ...named({ description, when: expression, effects: { type: 'array', minItems: 1, items: effect }, timing: { enum: ['batch', 'action'] } }),
            required: ['id', 'description', 'when', 'effects'],
        } },
        constraints: { type: 'array', items: named({ test: expression, description }) },
        functions: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, required: ['reads', 'description'], properties: { reads: { type: 'array', items: path }, description } } },
        views: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, required: ['paths', 'description'], properties: { paths: { type: 'array', items: path }, description } } },
        extensions: { type: 'object', additionalProperties: false, properties: {
            tools: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false,
                required: [...Object.keys(extensionProperties), 'parameters', 'stages'], properties: { ...extensionProperties, parameters: { type: 'object' }, stages: { ...stages, minItems: 0 } } } },
            scripts: { type: 'object', additionalProperties: false, properties: Object.fromEntries(SCRIPT_PHASES.map(phase => [phase, script])) },
        } },
    },
    $defs: { expression: { oneOf: [
        { type: 'object', additionalProperties: false, required: ['literal'], properties: { literal: {} } },
        ...['get', 'before', 'param', 'prepared'].map(key => ({ type: 'object', additionalProperties: false, required: [key], properties: { [key]: path } })),
        { type: 'object', additionalProperties: false, required: ['op', 'args'], properties: { op: { enum: ['add', 'subtract', 'multiply', 'divide', 'min', 'max', 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'and', 'or', 'not', 'if', 'length', 'includes'] }, args: { type: 'array', items: expression } } },
        { type: 'object', additionalProperties: false, required: ['call', 'args'], properties: { call: { type: 'string' }, args: { type: 'array', items: expression } } },
    ] } },
};
