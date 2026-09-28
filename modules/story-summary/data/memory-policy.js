import { sha256 } from '../../../libs/js-sha256.mjs';
import { SUMMARY_GENERATION_RULES } from './generation-rules.js';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const memoryDigest = value => sha256(JSON.stringify(canonical(value)) ?? 'null');
export const SUMMARY_STANDARD = memoryDigest(SUMMARY_GENERATION_RULES);

// Persisted only with a generated batch/review receipt. It identifies the rules
// used then, survives restart, and disappears with that history; no prompt copies.
export function memoryPolicy(filterRules = []) {
    return { standard: SUMMARY_STANDARD, filterRules: structuredClone(filterRules) };
}

export function isMemoryPolicy(value) {
    return !!value && typeof value.standard === 'string' && /^[a-f0-9]{64}$/u.test(value.standard)
        && Array.isArray(value.filterRules) && value.filterRules.every(rule => rule && typeof rule.start === 'string' && typeof rule.end === 'string');
}
