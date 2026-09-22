import { COC7_DIFFICULTIES, type Coc7Difficulty } from './coc7-request.js';

export const COC7_LEVELS = ['fumble', 'failure', 'regular', 'hard', 'extreme', 'critical'] as const;
export type Coc7Level = typeof COC7_LEVELS[number];
export type Coc7Verdict = 'achieved' | 'not_achieved';
export const COC7_CRITICAL_ROLL = 1;
export function coc7FumbleMinimum(threshold: number): number { return threshold < 50 ? 96 : 100; }
export interface Coc7Result {
    value: number;
    units: number;
    tens: number;
    roll: number;
    threshold: number;
    level: Coc7Level;
    verdict: Coc7Verdict;
}
export function coc7Percentile(units: number, tens: number): number { return tens * 10 + units || 100; }
export function coc7Level(value: number, threshold: number, roll: number): Coc7Level {
    if (roll === COC7_CRITICAL_ROLL) { return 'critical'; }
    if (roll >= coc7FumbleMinimum(threshold)) { return 'fumble'; }
    if (roll <= Math.floor(value / COC7_DIFFICULTIES.extreme)) { return 'extreme'; }
    if (roll <= Math.floor(value / COC7_DIFFICULTIES.hard)) { return 'hard'; }
    return roll <= value ? 'regular' : 'failure';
}
function digit(random: () => number): number {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) { throw new TypeError('dice_random_invalid'); }
    return Math.floor(sample * 10);
}
/** Value is resolved by the app, never accepted as a model-supplied number. */
export function rollCoc7(value: number, difficulty: Coc7Difficulty, random: () => number = Math.random): Coc7Result {
    if (!Number.isSafeInteger(value) || value < 1 || !Object.hasOwn(COC7_DIFFICULTIES, difficulty)) { throw new TypeError('dice_coc7_basis_invalid'); }
    const threshold = Math.floor(value / COC7_DIFFICULTIES[difficulty]);
    const units = digit(random);
    const tens = digit(random);
    const roll = coc7Percentile(units, tens);
    const level = coc7Level(value, threshold, roll);
    const achieved = level === 'critical' || level !== 'fumble' && level !== 'failure' && roll <= threshold;
    return { value, units, tens, roll, threshold, level, verdict: achieved ? 'achieved' : 'not_achieved' };
}
/** Validate shape, without rerolling or re-adjudicating historical facts. */
export function parseCoc7Result(value: unknown): Coc7Result {
    const fields = ['value', 'units', 'tens', 'roll', 'threshold', 'level', 'verdict'];
    const invalid = (): never => { throw new TypeError('dice_record_invalid'); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return invalid(); }
    const result = value as Coc7Result;
    const face = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 9;
    if (Object.keys(result).length !== fields.length || fields.some(key => !Object.hasOwn(result, key))
        || !Number.isSafeInteger(result.value) || result.value < 1 || !face(result.units) || !face(result.tens)
        || !Number.isInteger(result.roll) || result.roll < 1 || result.roll > 100
        || !Number.isSafeInteger(result.threshold) || result.threshold < 0
        || !COC7_LEVELS.includes(result.level) || !['achieved', 'not_achieved'].includes(result.verdict)) { return invalid(); }
    return { ...result };
}
