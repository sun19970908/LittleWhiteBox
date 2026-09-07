import { ECONOMY_TRANSACTION_CAPABILITY, type EconomyReadCapability } from '../../../capabilities/economy/index.js';
import { learningRewardInput, matchesLearningReward } from '../../../domains/learning/reward.js';
import type { LearningTeacherPreference } from '../../../domains/learning/profile.js';
import type { LearningCompletion } from '../../../domains/learning/types.js';
import type { ScopedChatStore, XiaobaiOsFileControls } from '../../../kernel/contracts.js';
import { confirmedLearning, type LearningRepository } from './service.js';

export type LearningRewardStatus = 'paid' | 'wallet-closed' | 'other-story' | 'unconfirmed' | 'conflict' | 'failed' | 'cancelled';

/** Completion, ledger, receipt: three confirmations; neither store pretends to own both files. */
export function createLearningRewards(deps: {
    repository: LearningRepository; store: ScopedChatStore<LearningTeacherPreference>;
    economy: EconomyReadCapability; files: XiaobaiOsFileControls;
}) {
    let running = false;
    async function settle(language: string, unitId: string, openWallet: boolean, isCurrent: () => boolean): Promise<LearningRewardStatus> {
        if (running) { return 'cancelled'; }
        running = true;
        try {
            await deps.repository.read();
            const snapshot = deps.repository.snapshot();
            if (snapshot.status !== 'ready') { return snapshot.status === 'conflict' ? 'conflict' : 'unconfirmed'; }
            const completion = snapshot.document?.data.profiles.find(profile => profile.language === language)?.completions.find(item => item.unitId === unitId);
            if (!completion || !isCurrent()) { return 'cancelled'; }
            if (completion.receipt) { return 'paid'; }
            const initial = await deps.store.read();
            if (!isCurrent()) { return 'cancelled'; }
            if (initial.osId !== completion.reward.originOsId) { return 'other-story'; }
            const sameCompletion = () => {
                const current = deps.repository.snapshot();
                return current.status === 'ready' && JSON.stringify(current.document?.data.profiles.find(profile => profile.language === language)
                    ?.completions.find(item => item.unitId === unitId)) === JSON.stringify(completion);
            };
            const guard = () => isCurrent() && sameCompletion() && deps.store.peekCurrent()?.osId === initial.osId
                && deps.store.peekCurrent()?.identityKey === initial.identityKey;
            if (deps.files.hasPendingCommit()) { return 'unconfirmed'; }
            await deps.economy.refresh();
            if (!guard()) { return 'cancelled'; }
            if (!deps.economy.isOpen()) {
                if (!openWallet) { return 'wallet-closed'; }
                // The scoped transaction guard prevents account opening after a queued chat switch.
                // ensureOpen is invoked only by the explicit user action, never on view/activation.
                await deps.economy.ensureOpen(guard);
                if (!guard()) { return 'cancelled'; }
            }
            const result = await deps.store.transact(transaction => {
                if (!guard()) { throw new Error('learning_reward_cancelled'); }
                const economy = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
                const input = learningRewardInput(completion);
                const existing = economy.listOwnedTransactions().find(item => item.idempotencyKey === input.idempotencyKey);
                if (existing) {
                    if (!matchesLearningReward(existing, completion)) { throw new Error('learning_reward_mismatch'); }
                    return existing;
                }
                const { sourceDomain: _source, ...leg } = input;
                return economy.postAction({ legs: [leg] }).transactions[0];
            }, { commitGuard: guard });
            if (!guard()) { return 'cancelled'; }
            if (result.status !== 'confirmed' && result.status !== 'unchanged') { return result.status; }
            const transaction = result.result;
            if (!transaction || !matchesLearningReward(transaction, completion)) { return 'failed'; }
            const expected = confirmedLearning(deps.repository);
            const data = structuredClone(expected!.data);
            const saved = data.profiles.find(profile => profile.language === language)!.completions.find(item => item.unitId === unitId)!;
            saved.receipt = { transactionId: transaction.id, receivedAt: transaction.createdAt };
            const receipt = await deps.repository.save(expected, data, guard);
            return receipt.status === 'confirmed' || receipt.status === 'unchanged' ? 'paid' : receipt.status;
        } catch { return isCurrent() ? 'failed' : 'cancelled'; }
        finally { running = false; }
    }
    return {
        settle,
        status(completion: LearningCompletion, osId: string | null): LearningRewardStatus | 'available' {
            if (completion.receipt) { return 'paid'; }
            if (completion.reward.originOsId !== osId) { return 'other-story'; }
            if (!deps.economy.isOpen()) { return 'wallet-closed'; }
            return 'available';
        },
    };
}
