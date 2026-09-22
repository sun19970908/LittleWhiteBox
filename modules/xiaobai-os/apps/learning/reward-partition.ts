import type { PartitionRegistration } from '../../kernel/contracts.js';

/** Upgrade tombstones: learning outcomes survive the one-time economy reset, old claims do not. */
export interface LearningRewardPolicy { retiredUnitIds: string[] }
export const LEARNING_REWARDS_PARTITION: PartitionRegistration<LearningRewardPolicy> = Object.freeze({
    key: 'learning-rewards', ownerId: 'learning', storage: 'user', schemaVersion: 1,
    parse(value: unknown) {
        const record = value as Partial<LearningRewardPolicy> | null;
        if (!record || Object.keys(record).join(',') !== 'retiredUnitIds' || !Array.isArray(record.retiredUnitIds)
            || record.retiredUnitIds.some(id => typeof id !== 'string' || !id)) {
            return { ok: false as const, error: { code: 'partition_invalid' as const, message: 'Invalid learning reward policy' } };
        }
        return { ok: true as const, value: { retiredUnitIds: [...new Set(record.retiredUnitIds)] } };
    },
    serialize: (value: LearningRewardPolicy) => structuredClone(value),
    createInitial: () => ({ retiredUnitIds: [] }),
});
