import type {
    EconomyActionLeg,
    EconomyTransactionCapability,
} from '../../../capabilities/economy/index.js';
import { validateBankDomain } from '../../../domains/bank/invariants.js';
import { replayBankEvents } from '../../../domains/bank/timeline.js';
import {
    throwBankError,
    type BankActivity,
    type BankDomainV1,
    type BankEvent,
} from '../../../domains/bank/types.js';
import type { EconomyTransaction } from '../../../domains/economy/types.js';

const BANK_SOURCE_DOMAIN = 'bank';
const BANK_RESERVE_ACCOUNT = 'counterparty:bank:reserve';
const BANK_ESCROW_PREFIX = 'escrow:bank:';
type BankLeg = Omit<EconomyActionLeg, 'actionId' | 'sourceId' | 'idempotencyKey'>;

function inconsistency(detail: string): never {
    return throwBankError('bank_economy_inconsistent', detail);
}

function closePositionLegs(activity: BankActivity): BankLeg[] {
    const escrow = `${BANK_ESCROW_PREFIX}${activity.sourceId}`;
    const legs: BankLeg[] = [];
    if (activity.payout > activity.amountIn) {
        legs.push({
            fromAccountId: BANK_RESERVE_ACCOUNT,
            toAccountId: escrow,
            amount: activity.payout - activity.amountIn,
            kind: 'bank_position_profit',
            title: '银行收益补足',
        });
    }
    if (activity.payout > 0) {
        legs.push({
            fromAccountId: escrow,
            toAccountId: 'player',
            amount: activity.payout,
            kind: 'bank_position_payout',
            title: '银行头寸结算',
        });
    }
    if (activity.payout < activity.amountIn) {
        legs.push({
            fromAccountId: escrow,
            toAccountId: 'system:sink',
            amount: activity.amountIn - activity.payout,
            kind: 'bank_position_loss',
            title: '银行亏损核销',
        });
    }
    return legs;
}

export function buildBankEconomyLegs(event: BankEvent): EconomyActionLeg[] {
    const activities = new Map(event.result.activities.map(activity => [activity.sourceId, activity]));
    const closedIds = [...event.command.settledPositionIds];
    if (event.command.kind === 'deposit-withdraw-early') { closedIds.push(event.command.positionId); }
    const legs = closedIds.flatMap(positionId => {
        const activity = activities.get(positionId);
        return activity ? closePositionLegs(activity) : inconsistency(`activity:${event.actionId}:${positionId}`);
    });
    if (event.command.kind === 'deposit-open' || event.command.kind === 'fund-open') {
        legs.push({
            fromAccountId: 'player',
            toAccountId: `${BANK_ESCROW_PREFIX}${event.command.positionId}`,
            amount: event.command.amount,
            kind: 'bank_position_open',
            title: '银行头寸开立',
        });
    }
    return legs.map((leg, index) => ({
        ...leg,
        idempotencyKey: `bank:event:${event.revision}:leg:${index + 1}`,
        actionId: event.actionId,
        sourceId: event.actionId,
    }));
}

function sameLeg(transaction: EconomyTransaction, expected: EconomyActionLeg): boolean {
    return transaction.idempotencyKey === expected.idempotencyKey
        && transaction.actionId === expected.actionId
        && transaction.fromAccountId === expected.fromAccountId
        && transaction.toAccountId === expected.toAccountId
        && transaction.amount === expected.amount
        && transaction.kind === expected.kind
        && transaction.title === expected.title
        && transaction.note === (expected.note || '')
        && transaction.sourceDomain === BANK_SOURCE_DOMAIN
        && transaction.sourceId === expected.sourceId
        && transaction.reversalOfTransactionId === undefined;
}

export function validateBankEconomyConsistency(
    domain: BankDomainV1,
    economy: EconomyTransactionCapability,
    path = 'partitions.bank',
): void {
    validateBankDomain(domain);
    const owned = economy.listOwnedTransactions();
    const consumed = new Set<number>();
    for (const event of domain.events) {
        const expected = buildBankEconomyLegs(event);
        const actual = owned.filter(transaction => transaction.actionId === event.actionId);
        if (actual.length !== expected.length || actual.some((transaction, index) => !sameLeg(transaction, expected[index]))) {
            inconsistency(`${path}:action:${event.actionId}`);
        }
        actual.forEach(transaction => consumed.add(transaction.sequence));
    }
    if (consumed.size !== owned.length) { inconsistency(`${path}:orphan-transaction`); }

    const state = replayBankEvents(domain);
    const open = new Map(
        [...state.openDeposits, ...state.openInvestments].map(position => [position.id, position.principal]),
    );
    const allPositionIds = new Set(domain.events.flatMap(event => (
        event.command.kind === 'deposit-open' || event.command.kind === 'fund-open'
            ? [event.command.positionId]
            : []
    )));
    for (const positionId of allPositionIds) {
        if (economy.getAccountBalance(`${BANK_ESCROW_PREFIX}${positionId}`) !== (open.get(positionId) || 0)) {
            inconsistency(`${path}:escrow:${positionId}`);
        }
    }
}
