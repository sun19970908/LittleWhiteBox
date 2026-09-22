import type { PartitionRegistration } from '../../kernel/contracts.js';
import { assertJsonValue } from '../../kernel/envelope.js';

export interface DiceData { sheet: unknown }
export const DICE_PARTITION: PartitionRegistration<DiceData> = Object.freeze({
    key: 'dice', ownerId: 'dice', storage: 'user', schemaVersion: 1,
    parse(value: unknown) {
        const record = value as DiceData | null;
        try {
            assertJsonValue(value);
            if (!record || Object.keys(record).join(',') !== 'sheet') { throw new Error('Invalid Dice data'); }
            return { ok: true as const, value: structuredClone(record) };
        } catch (error) {
            return { ok: false as const, error: { code: 'partition_invalid' as const, message: String(error) } };
        }
    },
    serialize: (value: DiceData) => structuredClone(value),
    createInitial: () => ({ sheet: null }),
});
