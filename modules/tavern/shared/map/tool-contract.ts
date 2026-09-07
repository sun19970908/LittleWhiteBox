import { MAP_ATLAS_EDIT_TOOL } from './atlas-intent';
import { MAP_ELEMENT_CATEGORIES, MAP_THEMES, MAP_INTENT_SHAPES, ATLAS_LOCATION_SCALES, ATLAS_LOCATION_STATUSES } from './vocabulary';
import { TAVERN_MAP_MATERIALS, TAVERN_MAP_CERTAINTIES, TAVERN_MAP_MOODS } from '../map-semantics';
import { TAVERN_MAP_ELEMENT_KINDS } from '../map-material-symbols';

const MAX_STATE_READ_LIMIT = 300;

export function getTavernManagerStateToolDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }> {
    return [
        MAP_ATLAS_EDIT_TOOL,
        {
            type: 'function',
            function: {
                name: "MapAtlasRead",
                description: [
                    'Read the map world file for the current RP session.',
                    'The world file is the atlas: it lists known places, scene map files, links, and actor locations such as player.',
                    'Use the injected atlas when available; read only missing details. hasScene reports a linked scene layout; MapSceneRead verifies and reads that file.',
                ].join('\n'),
                parameters: {
                    type: 'object',
                    properties: {
                        mode: { type: 'string', enum: ['summary', 'document', 'locations', 'links', 'actors'], description: 'World read mode. Default summary.' },
                        query: { type: 'string', description: 'Optional location search text for locations mode.' },
                        actorKey: { type: 'string', description: 'Optional actor key filter for actors mode.' },
                        limit: { type: 'number', minimum: 1, maximum: MAX_STATE_READ_LIMIT },
                        offset: { type: 'number', minimum: 0 },
                    },
                    additionalProperties: false,
                },
            },
        },
        {
            type: 'function',
            function: {
                name: "MapSceneRead",
                description: [
                    'Read one scene map file by explicit scene name.',
                    'Use this when you need existing element ids before editing. Missing scene files are reported clearly; MapSceneEdit creates them automatically.',
                    'Document and elements use the same shape/geo coordinates as MapSceneEdit. Attached labels are included on their owner.',
                ].join('\n'),
                parameters: {
                    type: 'object',
                    properties: {
                        scene: { type: 'string', description: 'Explicit scene name or stable place key, such as 酒馆大厅 or 地下走廊.' },
                        mode: { type: 'string', enum: ['summary', 'elements', 'document', 'element'], description: 'Scene read mode. Default summary.' },
                        elementId: { type: 'string', description: 'Required for element mode.' },
                        query: { type: 'string', description: 'Optional element text/id/category search.' },
                        category: { type: 'string', enum: [...MAP_ELEMENT_CATEGORIES] },
                        limit: { type: 'number', minimum: 1, maximum: MAX_STATE_READ_LIMIT },
                        offset: { type: 'number', minimum: 0 },
                    },
                    required: ['scene'],
                    additionalProperties: false,
                },
            },
        },
        {
            type: 'function',
            function: {
                name: "MapSceneEdit",
                description: [
                    'Edit one scene by explicit scene name; creates its layout and atlas place when needed.',
                    'Elements use one shape plus geo, with an optional attached label. Existing ids preserve omitted fields; geo replaces the whole geometry.',
                    'Use only the minimum geo for the chosen shape: rect={center,size}, circle={at,radius}, icon={at,icon?}, path={points}, curve={curve}, label={at}+label. Do not fill unused geo keys.',
                    '`cat` and optional `kind` are closed semantics for map logic; `icon` is only a visual Material Symbols official name. If unsure about the official icon name, omit icon and provide kind/cat.',
                    'If one element is bad, that element is skipped and the other valid elements can still save. Read the returned applied/skipped/warnings report before retrying only failed elements.',
                ].join('\n'),
                parameters: {
                    type: 'object',
                    properties: {
                        scene: { type: 'string', description: 'Explicit scene name or stable place key.' },
                        title: { type: 'string', description: 'Optional display title. Defaults to scene.' },
                        scale: { type: 'string', enum: [...ATLAS_LOCATION_SCALES], description: 'Optional atlas location scale for new places. Default room.' },
                        status: { type: 'string', enum: [...ATLAS_LOCATION_STATUSES], description: 'Optional atlas location status. Defaults visited only when playerHere is true, otherwise mentioned.' },
                        playerHere: { type: 'boolean', description: 'Set true only when the current RP confirms the player is in this scene. This writes world.actors.player.locationKey.' },
                        viewBox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: 'Optional camera frame [x,y,width,height]. It does not move elements.' },
                        mood: { type: 'string', enum: [...TAVERN_MAP_MOODS], description: 'Optional scene mood when facts support it.' },
                        theme: { type: 'string', enum: [...MAP_THEMES], description: 'Optional renderer theme.' },
                        desc: { type: 'string', description: 'Short summary of this map edit.' },
                        dryRun: { type: 'boolean', description: 'Validate and compile without saving.' },
                        elements: {
                            type: 'array',
                            description: 'Tolerant scene element intents. Prefer one shape plus geo; if shape is missing, the runtime can infer it from geo or label.',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'Stable element id within this scene.' },
                                    cat: { type: 'string', enum: [...MAP_ELEMENT_CATEGORIES], description: 'Closed layer/category.' },
                                    kind: { type: 'string', enum: [...TAVERN_MAP_ELEMENT_KINDS], description: 'Optional closed system semantic: door/stairs/elevator/portal/passage/entrance/exit/trap/chest/marker/player/actor/north/south/east/west/up/down.' },
                                    shape: { type: 'string', enum: [...MAP_INTENT_SHAPES], description: 'One shape: rect/circle/path/curve/icon/label.' },
                                    geo: {
                                        type: 'object',
                                        description: 'Minimal geometry for the chosen shape only. Omit unused keys.',
                                        properties: {
                                            center: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Center [x,y] for shape:"rect".' },
                                            at: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Position [x,y] for circle, icon, or label.' },
                                            size: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Rect size [width,height].' },
                                            radius: { type: 'number', description: 'Circle radius.' },
                                            points: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, description: 'Path points.' },
                                            curve: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, description: 'Curve control/polyline points.' },
                                            icon: { type: 'string', description: 'Visual Material Symbols official name for shape:"icon", lowercase underscores. Examples: door_open, stairs, elevator, inventory_2, chair, table_bar, single_bed, local_bar, menu_book, science, biotech, swords, local_fire_department, water_drop, skull, park, location_on. Omit when unsure; renderer falls back from kind/cat.' },
                                        },
                                        additionalProperties: false,
                                    },
                                    label: { type: 'string', description: 'Optional label attached to this element. It is not a shape.' },
                                    actorKey: { type: 'string', description: 'Actor identity for cat:"actor". Use player for the player marker.' },
                                    material: { type: 'string', enum: [...TAVERN_MAP_MATERIALS], description: 'Surface material. Use terrain for the main floor/ground and fabric or bed-sheet for soft goods. Omit if unspecified.' },
                                    certainty: { type: 'string', enum: [...TAVERN_MAP_CERTAINTIES], description: 'Optional uncertainty marker; omit for confirmed.' },
                                    closed: { type: 'boolean', description: 'For path/curve, true joins the last point to the first and enables area fill in area categories; false or omitted on a new element leaves a line open.' },
                                },
                                required: ['id'],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ['scene', 'elements'],
                    additionalProperties: false,
                },
            },
        },
    ];
}
