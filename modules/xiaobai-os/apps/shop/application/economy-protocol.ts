import type {
    EconomyActionInput,
    EconomyTransactionCapability,
} from '../../../capabilities/economy/index.js';
import type { EconomyTransaction } from '../../../domains/economy/types.js';
import { getShopContract } from '../../../domains/shop/catalog.js';
import type { ShopDomainV2, ShopEvent } from '../../../domains/shop/types.js';

type ShopPurchaseEvent = ShopEvent & { action: { kind: 'purchase'; itemId: string } };

function inconsistency(message: string): Error {
    return Object.assign(new Error(message), { code: 'shop_economy_inconsistent' });
}

function purchaseEvents(domain: ShopDomainV2): ShopPurchaseEvent[] {
    return domain.events.filter((event): event is ShopPurchaseEvent => event.action.kind === 'purchase');
}

export function createShopPurchaseIntent(event: ShopEvent): EconomyActionInput {
    if (event.action.kind !== 'purchase') {
        throw new TypeError('Shop purchase intent requires a purchase event');
    }
    const item = getShopContract(event.action.itemId);
    return {
        legs: [{
            idempotencyKey: `shop:purchase:${event.actionId}`,
            actionId: event.actionId,
            fromAccountId: 'player',
            toAccountId: 'system:sink',
            amount: item.price,
            kind: 'shop_purchase',
            title: `购买${item.name}`,
            sourceId: item.id,
        }],
    };
}

function matchesPurchase(transaction: EconomyTransaction, event: ShopPurchaseEvent): boolean {
    const [intent] = createShopPurchaseIntent(event).legs;
    return transaction.idempotencyKey === intent.idempotencyKey
        && transaction.actionId === intent.actionId
        && transaction.fromAccountId === intent.fromAccountId
        && transaction.toAccountId === intent.toAccountId
        && transaction.amount === intent.amount
        && transaction.kind === intent.kind
        && transaction.title === intent.title
        && transaction.note === ''
        && transaction.sourceDomain === 'shop'
        && transaction.sourceId === intent.sourceId
        && transaction.reversalOfTransactionId === undefined;
}

export function validateShopEconomyConsistency(
    domain: ShopDomainV2,
    economy: Pick<EconomyTransactionCapability, 'listOwnedTransactions'>,
): void {
    const events = purchaseEvents(domain);
    const transactions = economy.listOwnedTransactions();
    if (events.length !== transactions.length) {
        throw inconsistency('Shop purchases and owned Economy transactions are inconsistent');
    }
    for (const event of events) {
        const matches = transactions.filter(transaction => transaction.actionId === event.actionId);
        if (matches.length !== 1 || !matchesPurchase(matches[0], event)) {
            throw inconsistency(`Shop purchase action is inconsistent: ${event.actionId}`);
        }
    }
}
