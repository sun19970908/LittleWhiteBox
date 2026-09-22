import { ACTION_CHECK_REQUEST_FIELDS } from './action-check.js';
import { COC7_DIFFICULTIES, type Coc7Difficulty } from './coc7-request.js';

// A result keeps the capability name used at the time, independently of today's
// request catalog. This is a historical fact, never a request to look up a sheet.
export interface Coc7RecordedRequest { action: string; stat: string; difficulty: Coc7Difficulty }
// Canonical checks need no annotation. Other checks retain the input mapping or
// untrained source as a historical fact, without consulting the current catalog.
export type Coc7Resolution = { kind: 'mapped'; input: string }
    | { kind: 'untrained'; reason: 'unknown' | 'ambiguous' };

export function parseCoc7Resolution(value: unknown): Coc7Resolution {
    const invalid = (): never => { throw new TypeError('dice_record_invalid'); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return invalid(); }
    const input = value as Coc7Resolution;
    if (Object.keys(input).length !== 2 || !Object.hasOwn(input, 'kind')) { return invalid(); }
    if (input.kind === 'mapped' && Object.hasOwn(input, 'input') && typeof input.input === 'string'
        && input.input.trim() && input.input.length <= ACTION_CHECK_REQUEST_FIELDS.stat.maxLength) {
        return { kind: input.kind, input: input.input };
    }
    if (input.kind === 'untrained' && Object.hasOwn(input, 'reason') && ['unknown', 'ambiguous'].includes(input.reason)) {
        return { kind: input.kind, reason: input.reason };
    }
    return invalid();
}

export function parseCoc7RecordedRequest(value: unknown): Coc7RecordedRequest {
    const invalid = (): never => { throw new TypeError('dice_record_invalid'); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return invalid(); }
    const input = value as Coc7RecordedRequest;
    if (Object.keys(input).length !== 3 || !['action', 'stat', 'difficulty'].every(key => Object.hasOwn(input, key))) { return invalid(); }
    for (const key of ['action', 'stat'] as const) {
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > ACTION_CHECK_REQUEST_FIELDS[key].maxLength) { return invalid(); }
    }
    if (typeof input.difficulty !== 'string' || !Object.hasOwn(COC7_DIFFICULTIES, input.difficulty)) { return invalid(); }
    return { action: input.action, stat: input.stat, difficulty: input.difficulty };
}
