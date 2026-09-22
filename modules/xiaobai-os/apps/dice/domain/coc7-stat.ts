import { COC7_CAPABILITIES, COC7_STAT_IDS, type Coc7Stat } from './coc7-catalog.js';
import { coc7StatValue, type Coc7Sheet } from './coc7-sheet.js';
import type { Coc7Resolution } from './coc7-record.js';

export const COC7_UNTRAINED_VALUE = 40;
export interface Coc7ResolvedStat { name: string; value: number; resolution?: Coc7Resolution }

function normalizeStat(input: string): string {
    return input.normalize('NFKC').replace(/[「」『』【】《》〈〉()[\]{}]/g, '').trim().toLowerCase();
}

/** Resolve a validated request against its run sheet; the percentile rules stay shared. */
export function resolveCoc7Stat(input: string, sheet: Coc7Sheet): Coc7ResolvedStat {
    const normalized = normalizeStat(input);
    const matched = (id: Coc7Stat): Coc7ResolvedStat => {
        const name = COC7_CAPABILITIES[id].label;
        return { name, value: coc7StatValue(sheet, id),
            ...(input === id || input === name ? {} : { resolution: { kind: 'mapped', input } as const }) };
    };
    // Resolve each tier as a set: catalog order must never decide between capabilities.
    const tiers = [
        (id: Coc7Stat) => normalized === id || normalized === COC7_CAPABILITIES[id].label,
        (id: Coc7Stat) => COC7_CAPABILITIES[id].uses.some(use => normalized === use),
        (id: Coc7Stat) => [COC7_CAPABILITIES[id].label, ...COC7_CAPABILITIES[id].uses].some(term => normalized.includes(term)),
    ];
    for (const matches of tiers) {
        const ids = COC7_STAT_IDS.filter(matches);
        if (ids.length === 1) { return matched(ids[0]!); }
        if (ids.length > 1) { return { name: input, value: COC7_UNTRAINED_VALUE, resolution: { kind: 'untrained', reason: 'ambiguous' } }; }
    }
    return { name: input, value: COC7_UNTRAINED_VALUE, resolution: { kind: 'untrained', reason: 'unknown' } };
}
