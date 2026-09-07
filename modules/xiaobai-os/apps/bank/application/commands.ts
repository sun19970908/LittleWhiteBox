import {
    assertBankProductAmount,
    createBankDepositFrozenContract,
    drawBankFundFrozenContract,
    getBankDepositProduct,
    getBankFundProduct,
} from '../../../domains/bank/products.js';
import {
    throwBankError,
    type BankActivity,
    type BankDepositPosition,
    type BankFundPosition,
    type BankRandomSource,
} from '../../../domains/bank/types.js';
import {
    assertPlayerCanFund,
    canonicalId,
    closeResult,
    createActivities,
    duePositions,
    type BankPosition,
} from './action-policy.js';
import type {
    BankOpenDepositCommand,
    BankOpenFundCommand,
    BankServiceView,
    BankSettleDueCommand,
    BankWithdrawDepositCommand,
    PreparedBankAction,
    RunBankAction,
} from './service.js';

interface BankCommandDependencies {
    createActivityId: () => string;
    createEventId: () => string;
    createPositionId: () => string;
    random: BankRandomSource;
    runAction: RunBankAction;
}

export function createBankCommands({
    createActivityId,
    createEventId,
    createPositionId,
    random,
    runAction,
}: BankCommandDependencies) {
    function generatedIds(prepared: PreparedBankAction, closedCount: number, includePosition: boolean): {
        eventId: string;
        positionId: string | null;
        activityIds: string[];
    } {
        const eventId = canonicalId(createEventId(), 'event-id');
        if (prepared.domain.events.some((event) => event.eventId === eventId)) {
            throwBankError('bank_invalid_context', 'event-id-conflict');
        }
        const positionId = includePosition ? canonicalId(createPositionId(), 'position-id', true) : null;
        if (positionId && prepared.domain.events.some((event) => (
            (event.command.kind === 'deposit-open' || event.command.kind === 'fund-open')
            && event.command.positionId === positionId
        ))) {
            throwBankError('bank_invalid_context', 'position-id-conflict');
        }
        const activityIds = Array.from({ length: closedCount }, () => canonicalId(createActivityId(), 'activity-id'));
        const existingActivityIds = new Set(prepared.domain.events.flatMap((event) => (
            event.result.activities.map((activity) => activity.id)
        )));
        if (new Set(activityIds).size !== activityIds.length || activityIds.some((id) => existingActivityIds.has(id))) {
            throwBankError('bank_invalid_context', 'activity-id-conflict');
        }
        return { eventId, positionId, activityIds };
    }

    function createActivitiesWithIds(
        positions: readonly { position: BankPosition; early: boolean }[],
        activityIds: readonly string[],
    ): BankActivity[] {
        let index = 0;
        return createActivities(positions, () => activityIds[index++] as string);
    }

    function openDeposit(input: BankOpenDepositCommand): Promise<BankServiceView> {
        return runAction('deposit-open', input, (prepared) => {
            const product = getBankDepositProduct(input.productId);
            const amount = assertBankProductAmount(product, input.amount);
            const due = duePositions(prepared.state, prepared.assistantTurn);
            assertPlayerCanFund(prepared.playerBalance, due, amount);
            const ids = generatedIds(prepared, due.length, true);
            const position: BankDepositPosition = {
                id: ids.positionId as string,
                productId: product.id,
                principal: amount,
                startTurn: prepared.assistantTurn,
                maturityTurn: prepared.assistantTurn + product.lockRounds,
                ...createBankDepositFrozenContract(product, amount),
            };
            const closed = due.map((entry) => ({ position: entry, early: false }));
            const result = closeResult(closed, createActivitiesWithIds(closed, ids.activityIds));
            result.changes.push({ kind: 'deposit-opened', position });
            return {
                eventId: ids.eventId,
                command: {
                    kind: 'deposit-open',
                    productId: product.id,
                    positionId: position.id,
                    amount,
                    settledPositionIds: due.map((entry) => entry.id),
                },
                result,
            };
        });
    }

    function withdrawDeposit(input: BankWithdrawDepositCommand): Promise<BankServiceView> {
        return runAction('deposit-withdraw-early', input, (prepared) => {
            const positionId = canonicalId(input.positionId, 'position-id');
            const target = prepared.state.openDeposits.find((position) => position.id === positionId);
            if (!target) {throwBankError('bank_position_missing', positionId);}
            if (target.maturityTurn <= prepared.assistantTurn) {throwBankError('bank_position_state_changed', positionId);}
            const due = duePositions(prepared.state, prepared.assistantTurn);
            const closed = [
                ...due.map((position) => ({ position, early: false })),
                { position: target, early: true },
            ];
            const ids = generatedIds(prepared, closed.length, false);
            return {
                eventId: ids.eventId,
                command: {
                    kind: 'deposit-withdraw-early',
                    positionId,
                    settledPositionIds: due.map((position) => position.id),
                },
                result: closeResult(closed, createActivitiesWithIds(closed, ids.activityIds)),
            };
        });
    }

    function openFund(input: BankOpenFundCommand): Promise<BankServiceView> {
        return runAction('fund-open', input, (prepared) => {
            const product = getBankFundProduct(input.productId);
            const amount = assertBankProductAmount(product, input.amount);
            const due = duePositions(prepared.state, prepared.assistantTurn);
            assertPlayerCanFund(prepared.playerBalance, due, amount);
            const ids = generatedIds(prepared, due.length, true);
            const contract = drawBankFundFrozenContract(product, amount, random);
            const position: BankFundPosition = {
                id: ids.positionId as string,
                productId: product.id,
                principal: amount,
                startTurn: prepared.assistantTurn,
                maturityTurn: prepared.assistantTurn + product.lockRounds,
                ...contract,
            };
            const closed = due.map((entry) => ({ position: entry, early: false }));
            const result = closeResult(closed, createActivitiesWithIds(closed, ids.activityIds));
            result.changes.push({ kind: 'fund-opened', position });
            return {
                eventId: ids.eventId,
                command: {
                    kind: 'fund-open',
                    productId: product.id,
                    positionId: position.id,
                    amount,
                    settledPositionIds: due.map((entry) => entry.id),
                },
                result,
            };
        });
    }

    function settleDue(input: BankSettleDueCommand): Promise<BankServiceView> {
        return runAction('settle-due', input, (prepared) => {
            const due = duePositions(prepared.state, prepared.assistantTurn);
            if (due.length === 0) {throwBankError('bank_no_due_positions');}
            const closed = due.map((position) => ({ position, early: false }));
            const ids = generatedIds(prepared, closed.length, false);
            return {
                eventId: ids.eventId,
                command: { kind: 'settle-due', settledPositionIds: due.map((position) => position.id) },
                result: closeResult(closed, createActivitiesWithIds(closed, ids.activityIds)),
            };
        });
    }

    return Object.freeze({ openDeposit, withdrawDeposit, openFund, settleDue });
}
