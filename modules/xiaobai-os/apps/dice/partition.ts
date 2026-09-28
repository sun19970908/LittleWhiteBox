import type { PartitionRegistration } from '../../kernel/contracts.js';
import { assertJsonValue } from '../../kernel/envelope.js';
import { parseResultOverride, type DiceResultOverride } from './domain/result-override.js';

export interface DiceData { sheet: unknown; resultOverrides: Record<string, DiceResultOverride> }
export const DICE_PARTITION: PartitionRegistration<DiceData> = Object.freeze({
    key: 'dice', ownerId: 'dice', storage: 'user', schemaVersion: 2,
    parse(value: unknown) {
        const record = value as DiceData | null;
        try {
            assertJsonValue(value);
            if (!record || Object.keys(record).sort().join(',') !== 'resultOverrides,sheet'
                || !record.resultOverrides || typeof record.resultOverrides !== 'object' || Array.isArray(record.resultOverrides)) {
                throw new Error('Invalid Dice data');
            }
            const resultOverrides = Object.fromEntries(Object.entries(record.resultOverrides).map(([key, value]) => {
                if (!/^[a-zA-Z0-9_-]+$/.test(key)) { throw new TypeError('dice_override_invalid'); }
                return [key, parseResultOverride(value)];
            }));
            return { ok: true as const, value: { sheet: structuredClone(record.sheet), resultOverrides } };
        } catch (error) {
            return { ok: false as const, error: { code: 'partition_invalid' as const, message: String(error) } };
        }
    },
    serialize: (value: DiceData) => structuredClone(value),
    createInitial: () => ({ sheet: null, resultOverrides: {} }),
});
