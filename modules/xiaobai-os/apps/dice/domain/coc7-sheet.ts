import { COC7_ATTRIBUTES, COC7_ATTRIBUTE_IDS, COC7_SKILL_IDS, type Coc7Attribute, type Coc7Skill, type Coc7Stat } from './coc7-catalog.js';

// Tavern adaptation, not official CoC character creation. Each random allocation
// also defines its group's budget, so generation, editing and saving cannot drift.
export const COC7_POINTS = { max: 80, step: 5 } as const;
export const COC7_POINT_GROUPS = {
    attributes: { ids: COC7_ATTRIBUTE_IDS, min: 20, allocation: [70, 60, 40, 30] },
    skills: { ids: COC7_SKILL_IDS, min: 10, allocation: [80, 70, 60, 50, 40, 40, 30, 30, 30, 20, 20, 10] },
} as const;
export type Coc7PointGroup = keyof typeof COC7_POINT_GROUPS;
export interface Coc7Sheet {
    attributes: Record<Coc7Attribute, number>;
    skills: Record<Coc7Skill, number>;
}
export type Coc7SheetState = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ready'; sheet: Coc7Sheet };
export const COC7_SHEET_ERRORS = { invalid: 'dice_coc7_sheet_invalid', missing: 'dice_coc7_sheet_missing' } as const;

export function coc7PointBudget(group: Coc7PointGroup): number {
    return COC7_POINT_GROUPS[group].allocation.reduce<number>((total, n) => total + n, 0);
}
export function coc7RemainingPoints(sheet: Coc7Sheet, group: Coc7PointGroup): number {
    return coc7PointBudget(group) - Object.values(sheet[group]).reduce((total, n) => total + n, 0);
}
export function coc7StatValue(sheet: Coc7Sheet, stat: Coc7Stat): number {
    return Object.hasOwn(COC7_ATTRIBUTES, stat) ? sheet.attributes[stat as Coc7Attribute] : sheet.skills[stat as Coc7Skill];
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
export function parseCoc7Sheet(value: unknown): Coc7Sheet {
    const invalid = (): never => { throw new TypeError(COC7_SHEET_ERRORS.invalid); };
    if (!exact(value, Object.keys(COC7_POINT_GROUPS))) { return invalid(); }
    for (const group of Object.keys(COC7_POINT_GROUPS) as Coc7PointGroup[]) {
        const scores = value[group];
        if (!exact(scores, COC7_POINT_GROUPS[group].ids)) { return invalid(); }
        if (!Object.values(scores).every(n => typeof n === 'number' && Number.isInteger(n)
            && n >= COC7_POINT_GROUPS[group].min && n <= COC7_POINTS.max && n % COC7_POINTS.step === 0)
            || Object.values(scores).reduce<number>((total, n) => total + (n as number), 0) > coc7PointBudget(group)) { return invalid(); }
    }
    const sheet = value as unknown as Coc7Sheet;
    return { attributes: { ...sheet.attributes }, skills: { ...sheet.skills } };
}
/** Invalid persisted input stays intact until an explicit replacement or clear. */
export function readCoc7Sheet(value: unknown): Coc7SheetState {
    if (value === null) { return { kind: 'empty' }; }
    try { return { kind: 'ready', sheet: parseCoc7Sheet(value) }; }
    catch (error) {
        if (!(error instanceof TypeError) || error.message !== COC7_SHEET_ERRORS.invalid) { throw error; }
        return { kind: 'invalid' };
    }
}
