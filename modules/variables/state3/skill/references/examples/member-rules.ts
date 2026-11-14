import type { Bundle } from '../../../types.js';

/** Dynamic people, fixed identities and bounded per-member values. */
export function memberRulesExample(): Bundle {
    return {
        definition: {
            format: 1, name: 'Dynamic guild', updates: ['after'],
            initial: { guild: { members: {}, reputation: 0 } },
            schema: { type: 'object', required: ['guild'], additionalProperties: false, properties: { guild: {
                type: 'object', required: ['members', 'reputation'], additionalProperties: false, properties: {
                    reputation: { type: 'number', minimum: 0 }, members: { type: 'object', additionalProperties: {
                        type: 'object', required: ['identity', 'mood'], additionalProperties: false,
                        properties: { identity: { type: 'string' }, mood: { type: 'number', minimum: -5, maximum: 5 } },
                    } },
                },
            } } },
            access: [{path:['guild','members'],direct:true,description:'Current members keyed by stable id. Each identity stays fixed while the member remains; mood is between -5 and 5.'},
                {path:['guild','reputation'],direct:true,description:'Reputation only increases.'}],
            actions: [], rules: [
                {id:'member_moods',kind:'correct',path:['guild','members'],value:{call:'clamp_moods',args:[]},description:'Clamp each member’s mood independently to -5 through 5.'},
                {id:'reputation_floor',kind:'correct',path:['guild','reputation'],value:{op:'max',args:[{get:['guild','reputation']},{before:['guild','reputation']}]},description:'Reputation never falls below the batch starting value.'},
            ],
            constraints: [{id:'member_identity',test:{call:'same_identities',args:[]},description:'An existing member’s identity remains unchanged.'}],
            functions: {
                clamp_moods:{reads:[['guild','members']],description:'Clamp numeric moods of all current members.'},
                same_identities:{reads:[['guild','members']],description:'Compare identities of retained members with the batch start.'},
            }, views: {},
        },
        functions: {
            clamp_moods:'(input,{get}) => Object.fromEntries(Object.entries(get(["guild","members"])).map(([id,member]) => [id,{...member,mood:typeof member.mood === "number" ? Math.max(-5,Math.min(5,member.mood)) : member.mood}]))',
            same_identities:'(input,{get,before}) => { const current=get(["guild","members"]); return Object.entries(before(["guild","members"])).every(([id,member]) => !Object.hasOwn(current,id) || current[id].identity === member.identity); }',
        },
    };
}
