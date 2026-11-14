import type { Bundle, Expression, Json } from '../types.js';

const literal = (value: Json): Expression => ({ literal: value });
const get = (...path: string[]): Expression => ({ get: path });
const op = (name: string, ...args: Expression[]): Expression => ({ op: name, args });

// An editable starter card, not special behaviour in the settlement engine.
export function equipmentExample(): Bundle {
    return {
        definition: {
            format: 1,
            updates: ['after'],
            name: '护符与生命',
            schema: {
                type: 'object', additionalProperties: false, required: ['hero'], properties: {
                    hero: { type: 'object', additionalProperties: false, required: ['baseHealth', 'health', 'maxHealth', 'amulet', 'condition'], properties: {
                        baseHealth: { type: 'number', title: '基础生命上限', exclusiveMinimum: 0 },
                        health: { type: 'number', title: '生命', minimum: 0 },
                        maxHealth: { type: 'number', title: '生命上限', exclusiveMinimum: 0 },
                        amulet: { type: 'boolean', title: '佩戴护符' }, condition: { type: 'string', title: '伤势' },
                    } },
                },
            },
            initial: { hero: { health: 80, amulet: true } },
            access: [
                { path: ['hero', 'baseHealth'], direct: false, description: '角色基础生命上限。' },
                { path: ['hero', 'health'], direct: true, description: '角色当前生命。', update: '依正文中的受伤与治疗改变生命。不能低于零；超过上限时由规则截断。' },
                { path: ['hero', 'amulet'], direct: false, description: '护符装备槽，true 表示已佩戴。', update: '正文明确装备或卸下护符时提交对应动作。' },
                { path: ['hero', 'maxHealth'], direct: false, description: '角色当前生命上限。' },
                { path: ['hero', 'condition'], direct: false, description: '角色当前伤势概况。' },
            ],
            rules: [
                { id: 'health-limit', kind: 'derive', path: ['hero', 'maxHealth'], value: op('add', get('hero', 'baseHealth'), op('if', get('hero', 'amulet'), literal(40), literal(0))), description: '佩戴护符时生命上限增加40。' },
                { id: 'health-cap', kind: 'correct', path: ['hero', 'health'], value: op('min', get('hero', 'health'), get('hero', 'maxHealth')), description: '生命超过新上限时降至新上限，不会因上限增加而自动治疗。' },
                { id: 'condition', kind: 'derive', path: ['hero', 'condition'], value: op('if', op('eq', get('hero', 'health'), get('hero', 'maxHealth')), literal('完好'), literal('受伤')), description: '生命等于上限时为完好，否则为受伤。' },
                { id: 'base-health', kind: 'derive', path: ['hero', 'baseHealth'], value: literal(60), description: '基础生命上限固定为60。' },
            ],
            actions: [
                { id: 'unequip', title: '卸下护符', parameters: { type: 'object', additionalProperties: false, properties: {} }, conversions: [], description: '卸下已佩戴的护符；上限随之降低，当前生命按规则调整。槽为空时不能卸下。', requires: op('eq', get('hero', 'amulet'), literal(true)), effects: [{ path: ['hero', 'amulet'], value: literal(false) }] },
                { id: 'equip', title: '装备护符', parameters: { type: 'object', additionalProperties: false, properties: {} }, conversions: [], description: '装备护符，前提是当前未佩戴；上限增加但不会自动治疗。', requires: op('eq', get('hero', 'amulet'), literal(false)), effects: [{ path: ['hero', 'amulet'], value: literal(true) }] },
            ],
            constraints: [{ id: 'health-valid', test: op('lte', get('hero', 'health'), get('hero', 'maxHealth')), description: '生命不能超过当前上限。' }],
            functions: {},
            views: {
                character: { paths: [['hero', 'health'], ['hero', 'maxHealth'], ['hero', 'condition']], description: '角色生命与伤势。' },
                equipment: { paths: [['hero', 'amulet']], description: '角色当前装备。' },
            },
        },
        functions: {},
    };
}
