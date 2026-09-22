import { ECONOMY_PARTITION } from '../capabilities/economy/index.js';
import { DICE_PARTITION } from '../apps/dice/partition.js';
import { LEARNING_REWARDS_PARTITION } from '../apps/learning/reward-partition.js';
import type { LearningRepository } from '../apps/learning/application/service.js';

/** First user document only. Never import any old chat's money or redeemable assets. */
export async function initialUserPartitions(sheet: unknown, learning: LearningRepository): Promise<Record<string, unknown>> {
    await learning.read();
    const snapshot = learning.snapshot();
    if (snapshot.status !== 'ready') { throw new Error('Learning records must be confirmed before resetting their rewards'); }
    return {
        [ECONOMY_PARTITION.key]: ECONOMY_PARTITION.createInitial(),
        [DICE_PARTITION.key]: { ...DICE_PARTITION.createInitial(), sheet },
        [LEARNING_REWARDS_PARTITION.key]: {
            retiredUnitIds: snapshot.document?.data.profiles.flatMap(profile => profile.completions.map(completion => completion.unitId)) ?? [],
        },
    };
}
