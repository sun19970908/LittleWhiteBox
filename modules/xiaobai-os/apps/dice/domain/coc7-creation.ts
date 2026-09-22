import { COC7_ATTRIBUTES, type Coc7Stat } from './coc7-catalog.js';
import { COC7_POINTS, COC7_POINT_GROUPS, COC7_SHEET_ERRORS, coc7RemainingPoints, coc7StatValue, parseCoc7Sheet, type Coc7PointGroup, type Coc7Sheet } from './coc7-sheet.js';

// Drafts have every score from the start; unspent points are valid on save too.
export type Coc7Draft = Coc7Sheet;
function allocation(group: Coc7PointGroup, next: () => number) {
    return Object.fromEntries(COC7_POINT_GROUPS[group].ids.map(id => [id, next()]));
}
export function emptyCoc7Draft(): Coc7Draft {
    return { attributes: allocation('attributes', () => COC7_POINT_GROUPS.attributes.min), skills: allocation('skills', () => COC7_POINT_GROUPS.skills.min) } as Coc7Draft;
}
export function canAdjustCoc7Stat(draft: Coc7Draft, stat: Coc7Stat, direction: -1 | 1): boolean {
    const group = Object.hasOwn(COC7_ATTRIBUTES, stat) ? 'attributes' : 'skills';
    const next = coc7StatValue(draft, stat) + direction * COC7_POINTS.step;
    return (direction === -1 || direction === 1) && next >= COC7_POINT_GROUPS[group].min && next <= COC7_POINTS.max
        && (direction < 0 || coc7RemainingPoints(draft, group) >= COC7_POINTS.step);
}
export function adjustCoc7Stat(draft: Coc7Draft, stat: Coc7Stat, direction: -1 | 1): Coc7Draft {
    if (!canAdjustCoc7Stat(draft, stat, direction)) { throw new TypeError(COC7_SHEET_ERRORS.invalid); }
    const group = Object.hasOwn(COC7_ATTRIBUTES, stat) ? 'attributes' : 'skills';
    return { ...draft, [group]: { ...draft[group], [stat]: coc7StatValue(draft, stat) + direction * COC7_POINTS.step } };
}
export function generateCoc7Sheet(random: () => number = Math.random): Coc7Sheet {
    const drawGroup = (group: Coc7PointGroup) => {
        const values: number[] = [...COC7_POINT_GROUPS[group].allocation];
        return allocation(group, () => {
            const sample = random();
            if (!Number.isFinite(sample) || sample < 0 || sample >= 1) { throw new TypeError('dice_random_invalid'); }
            return values.splice(Math.floor(sample * values.length), 1)[0];
        });
    };
    return parseCoc7Sheet({ attributes: drawGroup('attributes'), skills: drawGroup('skills') });
}
