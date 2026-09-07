import type { TavernAtlasDocument, TavernAtlasLinkKind, TavernAtlasPatchOp } from '../structured-state';
import { ATLAS_LOCATION_SCALES, ATLAS_LOCATION_STATUSES, ATLAS_LINK_KINDS, normalizeAtlasKeyOrThrow } from './vocabulary';

const text = { type: 'string', minLength: 1, maxLength: 120 };
const optionalText = { type: ['string', 'null'], maxLength: 240 };
const linkId = { ...text, maxLength: 160 };
const locationFields = {
    key: text, name: text,
    scale: { type: 'string', enum: [...ATLAS_LOCATION_SCALES] },
    status: { type: 'string', enum: [...ATLAS_LOCATION_STATUSES] },
    parent: { ...text, type: ['string', 'null'], description: 'Containing place key; null moves the place to the root. Parent and child may be in the same call.' },
    brief: { ...optionalText, description: 'What distinguishes this place; null clears it. A place existing does not establish an event or visit.' },
};
const linkFields = {
    id: linkId, from: text, to: text,
    kind: { type: 'string', enum: [...ATLAS_LINK_KINDS] },
    label: text, bidirectional: { type: 'boolean' },
};

export const MAP_ATLAS_EDIT_TOOL = {
    type: 'function' as const,
    function: {
        name: 'MapAtlasEdit',
        description: 'Maintain world places, their hierarchy and routes without drawing a scene for each place. Omitted place fields are preserved; new places require name and default to room/mentioned. Route endpoints must exist or be created in this call; omit id for a stable endpoint/kind-derived id, bidirectional defaults true. Each route entry replaces its fields; removeLinks deletes explicit route ids. hasScene in reads is read-only. The whole call is atomic: on failure nothing saves; unchanged is success. Player movement belongs to MapSceneEdit playerHere; other actor markers belong to scene elements.',
        parameters: {
            type: 'object', additionalProperties: false,
            properties: {
                locations: { type: 'array', maxItems: 300, items: { type: 'object', properties: locationFields, required: ['key'], additionalProperties: false } },
                links: { type: 'array', maxItems: 300, items: { type: 'object', properties: linkFields, required: ['from', 'to', 'kind'], additionalProperties: false } },
                removeLinks: { type: 'array', maxItems: 300, items: linkId },
                dryRun: { type: 'boolean', description: 'Validate without saving.' },
                desc: { type: 'string', maxLength: 400 },
            },
        },
    },
};

function record(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {throw new TypeError(`${label} must be an object.`);}
    const result = value as Record<string, unknown>;
    const extra = Object.keys(result).filter(key => !fields.includes(key));
    if (extra.length) {throw new TypeError(`${label}: unsupported fields ${extra.join(', ')}.`);}
    return result;
}

function string(value: unknown, label: string, max = 120): string {
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max) {throw new TypeError(`${label} must be a nonempty string of at most ${max} characters.`);}
    return value.trim();
}

/** Wire intent becomes the existing atomic atlas transaction, never another stored format. */
export function compileAtlasIntent(args: Record<string, unknown>, current: TavernAtlasDocument): TavernAtlasPatchOp[] {
    record(args, ['locations', 'links', 'removeLinks', 'dryRun', 'desc'], 'MapAtlasEdit');
    if (args.dryRun !== undefined && typeof args.dryRun !== 'boolean') {throw new TypeError('dryRun must be boolean.');}
    if (args.desc !== undefined) {string(args.desc, 'desc', 400);}
    const list = (key: string): unknown[] => {
        if (args[key] === undefined) {return [];}
        if (!Array.isArray(args[key]) || args[key].length > 300) {throw new TypeError(`${key} must be an array with at most 300 items.`);}
        return args[key];
    };
    const locations = list('locations').map(value => record(value, Object.keys(locationFields), 'location'));
    const byKey = new Map<string, Record<string, unknown>>();
    for (const location of locations) {
        const key = normalizeAtlasKeyOrThrow(string(location.key, 'location.key'), 'atlas_location_key_invalid');
        if (byKey.has(key)) {throw new TypeError(`Duplicate location key: ${key}.`);}
        byKey.set(key, location);
    }
    const ops: TavernAtlasPatchOp[] = [];
    const visiting = new Set<string>();
    const done = new Set<string>();
    const addPlace = (key: string): void => {
        if (done.has(key)) {return;}
        if (visiting.has(key)) {throw new TypeError(`Cyclic location parent: ${key}.`);}
        visiting.add(key);
        const location = byKey.get(key)!;
        if (location.parent !== undefined && location.parent !== null) {
            const parent = normalizeAtlasKeyOrThrow(string(location.parent, 'location.parent'), 'atlas_location_key_invalid');
            if (byKey.has(parent)) {addPlace(parent);}
        }
        const existing = current.locations.find(item => item.key === key);
        const set: Record<string, unknown> = {};
        const unset: Array<'parent' | 'brief'> = [];
        for (const [field, value] of Object.entries(location)) {
            if (field === 'key') {continue;}
            if (value === null && (field === 'parent' || field === 'brief')) {unset.push(field); continue;}
            const normalized = string(value, `location.${field}`, field === 'brief' ? 240 : 120);
            const allowed = field === 'scale' ? locationFields.scale.enum : field === 'status' ? locationFields.status.enum : null;
            if (allowed && !allowed.some(item => item === normalized)) {throw new TypeError(`Invalid location.${field}: ${normalized}.`);}
            set[field] = field === 'parent' ? normalizeAtlasKeyOrThrow(normalized, 'atlas_location_key_invalid') : normalized;
        }
        if (!existing) {
            if (!set.name) {throw new TypeError(`New location ${key} needs name.`);}
            set.scale ??= 'room'; set.status ??= 'mentioned';
        }
        ops.push({ op: 'upsert-location', key, set, ...(unset.length ? { unset } : {}) });
        visiting.delete(key); done.add(key);
    };
    for (const key of byKey.keys()) {addPlace(key);}
    for (const value of list('removeLinks')) {ops.push({ op: 'remove-link', id: string(value, 'removeLinks id', 160) });}
    for (const value of list('links')) {
        const link = record(value, Object.keys(linkFields), 'link');
        const kind = string(link.kind, 'link.kind');
        if (!linkFields.kind.enum.some(item => item === kind)) {throw new TypeError(`Invalid link.kind: ${kind}.`);}
        if (link.bidirectional !== undefined && typeof link.bidirectional !== 'boolean') {throw new TypeError('link.bidirectional must be boolean.');}
        ops.push({
            op: 'upsert-link', from: string(link.from, 'link.from'), to: string(link.to, 'link.to'),
            kind: kind as TavernAtlasLinkKind,
            ...(link.id === undefined ? {} : { id: string(link.id, 'link.id', 160) }),
            ...(link.label === undefined ? {} : { label: string(link.label, 'link.label') }),
            ...(typeof link.bidirectional === 'boolean' ? { bidirectional: link.bidirectional } : {}),
        });
    }
    return ops;
}
