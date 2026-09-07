import type { EconomyTransaction, PostTransactionInput } from '../economy/types.js';
import type { LearningCompletion, RewardTier } from './types.js';

export const LEARNING_REWARD_PRICES: Readonly<Record<RewardTier, number>> = Object.freeze({ short: 20, regular: 40, deep: 60 });

export function learningRewardInput(completion: LearningCompletion): PostTransactionInput {
    const key = `learning:unit:${completion.unitId}`;
    return { actionId: key, idempotencyKey: key, fromAccountId: 'counterparty:learning:rewards', toAccountId: 'player',
        amount: completion.reward.amount, kind: 'learning_reward', title: completion.reward.title, note: completion.reward.note,
        sourceDomain: 'learning', sourceId: completion.unitId };
}

export function matchesLearningReward(transaction: EconomyTransaction, completion: LearningCompletion) {
    const input = learningRewardInput(completion);
    return Object.entries(input).every(([key, value]) => transaction[key as keyof EconomyTransaction] === value);
}
