import { EconomyError } from '../../../domains/economy/types.js';
import {
    throwBankError,
    type BankAction,
    type BankActivity,
    type BankCasToken,
    type BankDepositPosition,
    type BankDepositProductId,
    type BankDomainV1,
    type BankEvent,
    type BankEventResult,
    type BankFundPosition,
    type BankFundProductId,
    type BankState,
} from '../../../domains/bank/types.js';

const GENERATED_ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export type BankPosition = BankDepositPosition | BankFundPosition;
export type BankCommandInput = BankCasToken & { actionId: string } & Partial<{
    productId: BankDepositProductId | BankFundProductId;
    amount: number;
    positionId: string;
}>;
export function canonicalId(value: unknown, detail: string, accountSafe = false): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > 200 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
        || (accountSafe && !GENERATED_ACCOUNT_ID_PATTERN.test(value))) {
        throwBankError('bank_invalid_context', detail);
    }
    return value;
}

export function assertActionId(value: unknown): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || value.length > 200 || Array.from(value).length > 200
        || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
        throwBankError('bank_action_required');
    }
    return value;
}

export function assertCas(domain: BankDomainV1, input: BankCasToken): void {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
        || typeof input.expectedEventId !== 'string'
        || input.expectedEventId !== input.expectedEventId.trim()
        || Array.from(input.expectedEventId).length > 200
        || (input.expectedRevision === 0) !== (input.expectedEventId === '')) {
        throwBankError('bank_invalid_context', 'cas');
    }
    if (input.expectedRevision !== domain.events.length) {throwBankError('bank_revision_conflict');}
    if (input.expectedEventId !== (domain.events.at(-1)?.eventId ?? '')) {
        throwBankError('bank_event_id_conflict');
    }
}

export function replayMatches(event: BankEvent, kind: BankAction['kind'], input: BankCommandInput): boolean {
    if (event.command.kind !== kind) {return false;}
    if (kind === 'deposit-open' || kind === 'fund-open') {
        const command = event.command as Extract<BankAction, { kind: 'deposit-open' | 'fund-open' }>;
        return command.productId === input.productId && command.amount === input.amount;
    }
    if (kind === 'deposit-withdraw-early') {
        const command = event.command as Extract<BankAction, { kind: 'deposit-withdraw-early' }>;
        return command.positionId === input.positionId;
    }
    return true;
}

export function duePositions(state: BankState, currentTurn: number): BankPosition[] {
    return [...state.openDeposits, ...state.openInvestments]
        .filter((position) => position.maturityTurn <= currentTurn);
}

function payoutFor(position: BankPosition, early: boolean): number {
    if ('maturityAmount' in position) {
        return early ? position.earlyWithdrawalAmount : position.maturityAmount;
    }
    return position.settlementAmount;
}

export function createActivities(
    positions: readonly { position: BankPosition; early: boolean }[],
    createActivityId: () => string,
): BankActivity[] {
    return positions.map(({ position, early }) => {
        const payout = payoutFor(position, early);
        return {
            id: canonicalId(createActivityId(), 'activity-id'),
            sourceId: position.id,
            detail: 'maturityAmount' in position
                ? { kind: 'deposit', productId: position.productId, outcome: early ? 'withdrawn-early' : 'matured' }
                : { kind: 'fund', productId: position.productId, resolvedReturnBps: position.resolvedReturnBps },
            amountIn: position.principal,
            payout,
            net: payout - position.principal,
        };
    });
}

export function assertPlayerCanFund(
    playerBalance: number,
    settlements: readonly BankPosition[],
    amount: number,
): void {
    const available = settlements.reduce((total, position) => total + payoutFor(position, false), playerBalance);
    if (!Number.isSafeInteger(available) || available < amount) {
        throw new EconomyError('economy_insufficient_funds', 'player cannot be overdrawn');
    }
}

export function closeResult(positions: readonly { position: BankPosition; early: boolean }[], activities: BankActivity[]): BankEventResult {
    const positionIds = positions.map(({ position }) => position.id);
    return {
        changes: positionIds.length > 0 ? [{ kind: 'positions-closed', positionIds }] : [],
        activities,
    };
}
