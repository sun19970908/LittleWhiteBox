import { rollActionCheck } from '../domain/action-check.js';
import { DICE_RECORDS_SCHEMA_VERSION, MAX_ACTION_CHECKS, parseDiceRecords, type ActionCheckRecord, type DiceMessageRecords } from '../domain/check-records.js';
import { parseActionCheck } from '../protocol/request.js';
import { checkMarker } from '../domain/check-marker.js';
import { rollCoc7 } from '../domain/coc7.js';
import { resolveCoc7Stat, type Coc7ResolvedStat } from '../domain/coc7-stat.js';
import type { ActionCheckRule } from '../types.js';
import { readCoc7Sheet, COC7_SHEET_ERRORS, type Coc7Sheet } from '../domain/coc7-sheet.js';

export type PreparedActionCheck = { kind: 'none' } | { kind: 'invalid'; error: string }
    | { kind: 'candidate'; body: string; records: DiceMessageRecords };

/** No random call happens until the request, history and execution limit have been checked. */
export function prepareActionCheck(input: {
    body: string; generatedFrom: number; records?: unknown; id: string; random?: () => number; rule?: ActionCheckRule; coc7Sheet?: Coc7Sheet | null;
}): PreparedActionCheck {
    const parsed = parseActionCheck(input.body, input.generatedFrom, input.rule);
    if (parsed.kind !== 'request') { return parsed; }
    let basis: Coc7ResolvedStat | undefined;
    if (parsed.rule === 'coc7') {
        if (!input.coc7Sheet) { return { kind: 'invalid', error: COC7_SHEET_ERRORS.missing }; }
        const sheet = readCoc7Sheet(input.coc7Sheet);
        if (sheet.kind !== 'ready') { return { kind: 'invalid', error: COC7_SHEET_ERRORS.invalid }; }
        basis = resolveCoc7Stat(parsed.request.stat, sheet.sheet);
    }
    const records: DiceMessageRecords = input.records === undefined
        ? { schemaVersion: DICE_RECORDS_SCHEMA_VERSION, checks: [] } : parseDiceRecords(input.records);
    if (records.checks.length >= MAX_ACTION_CHECKS) { return { kind: 'invalid', error: 'dice_check_limit' }; }
    const marker = checkMarker(input.id);
    if (records.checks.some(record => record.id === input.id)) { throw new TypeError('dice_record_id_invalid'); }
    let record: ActionCheckRecord;
    if (parsed.rule === 'coc7') {
        const { name, value, resolution } = basis!;
        record = { id: input.id, rule: parsed.rule, request: { ...parsed.request, stat: name },
            result: rollCoc7(value, parsed.request.difficulty, input.random), ...(resolution ? { resolution } : {}) };
    } else {
        record = { id: input.id, rule: parsed.rule, request: parsed.request, ...rollActionCheck(parsed.request.difficulty, input.random) };
    }
    return { kind: 'candidate', body: parsed.body + marker,
        records: { ...records, checks: [...records.checks, record] } };
}
