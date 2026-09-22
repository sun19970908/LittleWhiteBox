import type { EconomyTransaction, PostTransactionInput } from '../../domains/economy/types.js';

/** Business APIs use local IDs. Only the ledger boundary qualifies them with the trusted story. */
export function economyScope(scope: string) {
    const prefix = scope === 'user' ? '' : `${scope}:`;
    const account = (id: string) => !prefix || id === 'player' || id.startsWith('system:')
        ? id : id.replace(/^([^:]+:[^:]+:)/, `$1${prefix}`);
    const localAccount = (id: string) => !prefix ? id : id.replace(/^([^:]+:[^:]+:)(.*)$/, (_match, head: string, tail: string) =>
        head + (tail.startsWith(prefix) ? tail.slice(prefix.length) : tail));
    return {
        account,
        qualify: (input: PostTransactionInput): PostTransactionInput => ({ ...input, sourceScope: scope,
            idempotencyKey: prefix + input.idempotencyKey, actionId: prefix + input.actionId,
            fromAccountId: account(input.fromAccountId), toAccountId: account(input.toAccountId) }),
        local: (transaction: EconomyTransaction): EconomyTransaction => ({ ...transaction,
            idempotencyKey: transaction.idempotencyKey.slice(prefix.length), actionId: transaction.actionId.slice(prefix.length),
            fromAccountId: localAccount(transaction.fromAccountId), toAccountId: localAccount(transaction.toAccountId) }),
    };
}
