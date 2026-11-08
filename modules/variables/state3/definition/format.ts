export const FORMAT = 1;
export const CARD_EXTENSION = 'lwb-state3';
export const CHAT_KEY = 'lwb-state3';
export const DEFINITION_FILE = 'variables/definition.json';
export const FUNCTION_DIRECTORY = 'variables/functions/';

const path = { type: 'array', minItems: 1, items: { type: 'string' } };
const expression = { $ref: '#/$defs/expression' };
const named = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: ['id', ...Object.keys(properties)], properties: { id: { type: 'string', minLength: 1 }, ...properties } });
const effect = { type: 'object', additionalProperties: false, required: ['path', 'value'], properties: { path, value: expression } };
const description = { type: 'string', minLength: 1 };
export const definitionSchema = {
    type: 'object', additionalProperties: false,
    required: ['format', 'name', 'schema', 'initial', 'access', 'rules', 'actions', 'constraints', 'functions', 'views'],
    properties: {
        format: { const: FORMAT }, name: description, schema: { type: 'object' }, initial: { type: 'object' },
        access: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'write', 'description'], properties: { path, write: { type: 'array', uniqueItems: true, items: { type: 'string' } }, description, update: description } } },
        rules: { type: 'array', items: named({ kind: { enum: ['derive', 'correct'] }, path, value: expression, description }) },
        actions: { type: 'array', items: named({ parameters: { type: 'object' }, description, requires: expression, effects: { type: 'array', minItems: 1, items: effect }, conversions: { type: 'array', items: effect } }) },
        triggers: { type: 'array', items: {
            ...named({ description, when: expression, effects: { type: 'array', minItems: 1, items: effect }, timing: { enum: ['batch', 'action'] } }),
            required: ['id', 'description', 'when', 'effects'],
        } },
        constraints: { type: 'array', items: named({ test: expression, description }) },
        functions: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, required: ['reads', 'description'], properties: { reads: { type: 'array', items: path }, description } } },
        views: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, required: ['paths', 'description'], properties: { paths: { type: 'array', items: path }, description } } },
    },
    $defs: { expression: { oneOf: [
        { type: 'object', additionalProperties: false, required: ['literal'], properties: { literal: {} } },
        ...['get', 'before', 'param'].map(key => ({ type: 'object', additionalProperties: false, required: [key], properties: { [key]: path } })),
        { type: 'object', additionalProperties: false, required: ['op', 'args'], properties: { op: { enum: ['add', 'subtract', 'multiply', 'divide', 'min', 'max', 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'and', 'or', 'not', 'if', 'length', 'includes'] }, args: { type: 'array', items: expression } } },
        { type: 'object', additionalProperties: false, required: ['call', 'args'], properties: { call: { type: 'string' }, args: { type: 'array', items: expression } } },
    ] } },
};
