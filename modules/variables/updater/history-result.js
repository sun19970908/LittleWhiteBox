import { ownedRoots, readRecord, readRecords } from '../state2/records.js';
import { calculateRebuild } from '../state2/rebuild.js';
import { getRulesSnapshot, replaceRules } from '../state2/guard-core.js';
import { presentResult } from './result.js';
import { TURN_SCOPE } from '../state2/turn-state.js';

export function hasUpdateRecord(target) {
    return readRecord(target.message)?.entries.some(entry => entry.scope === TURN_SCOPE) === true;
}

/** Read the target's actual execution points, not today's variables. No publish/save. */
export function readUpdateResult(ctx, target) {
    const records = readRecords(ctx.chat).slice(0, target.floor + 1);
    const record = records[target.floor];
    const entries = (record?.entries || []).filter((entry, index) => entry.scope === TURN_SCOPE
        && (record.resumeAt === undefined || index < record.resumeAt));
    const liveRules = getRulesSnapshot();
    try {
        return entries.map(entry => presentResult(calculateRebuild(ctx, records, ownedRoots(records), entry).result));
    } finally {
        replaceRules(liveRules);
    }
}
