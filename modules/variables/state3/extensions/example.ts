import type { Bundle } from '../types.js';

/** Executable authoring example. Preparation fixes one die result for this update. */
export function extensionExample(): Bundle {
    return {
        definition: {
            format: 1, name: '掷骰与行军', updates: ['before', 'after'],
            initial: { party: { stamina: 10, roll: 0 } },
            schema: { type: 'object', additionalProperties: false, required: ['party'], properties: {
                party: { type: 'object', additionalProperties: false, required: ['stamina', 'roll'], properties: {
                    stamina: { type: 'number', minimum: 0 }, roll: { type: 'integer', minimum: 0, maximum: 6 },
                } },
            } },
            access: [{ path: ['party', 'stamina'], direct: true, stages: ['after'], description: 'Stamina remaining after travel.' }],
            actions: [{ id: 'march', title: '行军', stages: ['before'], description: 'Travel spends stamina equal to the die result, recorded as roll.',
                parameters: { type: 'object', additionalProperties: false, required: ['roll'], properties: { roll: { type: 'integer', minimum: 1, maximum: 6 } } },
                conversions: [{ path: ['roll'], value: { prepared: ['roll'] } }], requires: { op: 'gte', args: [{ get: ['party', 'stamina'] }, { param: ['roll'] }] },
                effects: [{ path: ['party', 'roll'], value: { param: ['roll'] } },
                    { path: ['party', 'stamina'], value: { op: 'subtract', args: [{ get: ['party', 'stamina'] }, { param: ['roll'] }] } }],
            }],
            rules: [], constraints: [], functions: {}, views: {},
            extensions: {
                scripts: {
                    prepare: { title: '准备骰点', description: 'Roll one six-sided die for this update.', enabled: true },
                    committed: { title: '通知面板', description: 'Notify the card panel once after settlement.', enabled: true },
                },
            },
        }, functions: {},
        scripts: {
            prepare: 'return { roll: Math.floor(Math.random() * 6) + 1 };',
            committed: 'document.dispatchEvent(new CustomEvent("card:travel-settled", { detail: input })); return { notified: true };',
        },
    };
}

// Optional lookup: the author supplies a market worldbook containing prices.
export const marketToolExample = {
    declaration: { title: '查询市价', description: 'Read the named market worldbook when its prices are needed to choose what to trade. Prices already present in context need no lookup.',
        enabled: true, stages: ['before' as const], parameters: { type: 'object', required: ['book'], additionalProperties: false, properties: { book: { type: 'string' } } } },
    source: 'const book = await ctx.loadWorldInfo(input.book); if (!book?.entries) throw new Error("Market book unavailable"); return Object.values(book.entries).filter(entry => !entry.disable).map(entry => ({name:entry.comment,prices:entry.content}));',
};
