import { sha256 } from 'js-sha256';
import { ECONOMY_TRANSACTION_CAPABILITY } from '../../../capabilities/economy/index.js';
import type { UserTransactions } from '../../../kernel/user-transactions.js';
import { validateBankDomain } from '../../../domains/bank/invariants.js';
import { createEmptyBankDomain } from '../../../domains/bank/timeline.js';
import type { BankActivity, BankDepositPosition, BankDomainV1, BankFundPosition } from '../../../domains/bank/types.js';
import { BANK_PARTITION } from '../partition.js';
import { validateLegacyBankEconomyConsistency } from './economy-protocol.js';

/** Upgrades the production story-owned bank without ever recalculating a frozen contract. */
export async function upgradeBankUserFile(files: UserTransactions): Promise<void> {
    const result = await files.transactOwned(BANK_PARTITION, [ECONOMY_TRANSACTION_CAPABILITY], access => {
        const stories = access.stories();
        if (!stories.length) {return;}
        const stored = access.global();
        if (stored !== null) {validateBankDomain(stored);}
        const global: BankDomainV1 = stored === null ? createEmptyBankDomain() : structuredClone(stored);
        for (const { scopeId, raw } of stories) {
            const economy = access.useCapability(scopeId, ECONOMY_TRANSACTION_CAPABILITY);
            // The old replay and all posted legs must agree before touching a single coin.
            validateLegacyBankEconomyConsistency(raw, economy);
            const domain = raw;
            const open = new Map<string, BankDepositPosition | BankFundPosition>();
            for (const event of domain.events) {
                for (const change of event.result.changes) {
                    if (change.kind === 'deposit-opened' || change.kind === 'fund-opened') {
                        open.set(change.position.id, change.position);
                    } else {
                        change.positionIds.forEach(id => open.delete(id));
                    }
                }
                for (const activity of event.result.activities) {
                    global.history.push({ ...structuredClone(activity), sourceStoryId: scopeId,
                        revision: event.revision, eventId: event.eventId, actionId: event.actionId,
                        assistantTurn: event.assistantTurn, createdAt: event.createdAt });
                }
            }
            for (const position of open.values()) {
                const digest = sha256(`${scopeId}:${position.id}`);
                const key = `bank:upgrade:${digest}`;
                const paid = 'maturityAmount' in position ? position.maturityAmount : position.settlementAmount;
                const activity: BankActivity = {
                    id: key, sourceId: position.id,
                    detail: 'maturityAmount' in position
                        ? { kind: 'deposit', productId: position.productId, outcome: 'matured' }
                        : { kind: 'fund', productId: position.productId, resolvedReturnBps: position.resolvedReturnBps },
                    amountIn: position.principal, payout: paid, net: paid - position.principal,
                };
                const escrow = `escrow:bank:${position.id}`;
                economy.postAction({ legs: [
                    ...(paid > position.principal ? [{ fromAccountId: 'counterparty:bank:reserve',
                        toAccountId: escrow, amount: paid - position.principal, kind: 'bank_position_profit',
                        title: '银行收益补足', idempotencyKey: `${key}:profit`, actionId: key, sourceId: key }] : []),
                    ...(paid > 0 ? [{ fromAccountId: escrow, toAccountId: 'player', amount: paid,
                        kind: 'bank_position_payout', title: '旧存单升级结算',
                        idempotencyKey: `${key}:payout`, actionId: key, sourceId: key }] : []),
                    ...(paid < position.principal ? [{ fromAccountId: escrow, toAccountId: 'system:sink',
                        amount: position.principal - paid, kind: 'bank_position_loss',
                        title: '银行亏损核销', idempotencyKey: `${key}:loss`, actionId: key, sourceId: key }] : []),
                ] });
                if (economy.getAccountBalance(escrow) !== 0) {throw new Error('bank_upgrade_escrow_unsettled');}
                global.history.push({ ...activity, sourceStoryId: scopeId,
                    revision: domain.events.length + 1, eventId: key, actionId: key,
                    assistantTurn: position.maturityTurn, createdAt: Date.now() });
            }
            access.replaceStory(scopeId, null);
        }
        access.replaceGlobal(global);
    });
    if (result.status !== 'confirmed' && result.status !== 'unchanged') {
        const error = 'error' in result ? result.error : undefined;
        throw Object.assign(new Error(error?.message || `bank_upgrade_${result.status}`), {
            code: error?.code ?? `bank_upgrade_${result.status}`,
            uncertain: result.status === 'unconfirmed',
        });
    }
}
