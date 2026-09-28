import { rollAgainstDc } from './action-check.js';
import { rollCoc7AgainstThreshold } from './coc7.js';
import { isCheckContinuationPoint, parseDiceRecords, referencedActionChecks, type ActionCheckRecord, type DiceMessageRecords } from './check-records.js';

export const DICE_REROLL_COST = 10;

export function terminalCheck(body: string, records: unknown): ActionCheckRecord | null {
    if (records === undefined) { return null; }
    const last = referencedActionChecks(body, parseDiceRecords(records).checks).at(-1);
    return last && isCheckContinuationPoint(body, last) ? last : null;
}

/** Only random faces change; the check's captured adjudication basis remains a fact. */
export function rerollCheck(record: ActionCheckRecord, random: () => number = Math.random): ActionCheckRecord {
    return record.rule === 'd20'
        ? { ...structuredClone(record), ...rollAgainstDc(record.dc, random) }
        : { ...structuredClone(record), result: rollCoc7AgainstThreshold(record.result.value, record.result.threshold, random) };
}

export function replaceCheck(records: DiceMessageRecords, result: ActionCheckRecord): DiceMessageRecords {
    if (!records.checks.some(record => record.id === result.id)) { throw new Error('dice_target_changed'); }
    return { ...records, checks: records.checks.map(record => structuredClone(record.id === result.id ? result : record)) };
}
