import { validateBankDomain } from './invariants.js';
import {
    getBankDepositContract,
    getBankFundContract,
    listBankDepositProducts,
    listBankFundProducts,
} from './products.js';
import {
    calculateBankLockedAmount,
    createEmptyBankDomain,
    flattenBankActivities,
    replayBankEvents,
} from './timeline.js';
import {
    throwBankError,
    type BankClientView,
    type BankDomainV1,
    type BankFundPositionView,
    type BankPublicActivityRecord,
} from './types.js';

export const BANK_DEFAULT_ACTIVITY_PAGE_SIZE = 50 as const;
export const BANK_MAX_ACTIVITY_PAGE_SIZE = 100 as const;

export interface CreateBankViewInput {
    domain?: BankDomainV1 | null;
    currentTurn: number;
    activityOffset?: number;
    activityLimit?: number;
}

function pageInteger(value: unknown, fallback: number, minimum: number, maximum: number, detail: string): number {
    if (value === undefined) {return fallback;}
    if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throwBankError('bank_invalid_context', detail);
    }
    return Number(value);
}

function publicActivity(record: ReturnType<typeof flattenBankActivities>[number]): BankPublicActivityRecord {
    return {
        id: record.id,
        sourceId: record.sourceId,
        detail: structuredClone(record.detail),
        amountIn: record.amountIn,
        payout: record.payout,
        net: record.net,
        revision: record.revision,
        eventId: record.eventId,
        actionId: record.actionId,
        assistantTurn: record.assistantTurn,
        createdAt: record.createdAt,
    };
}

/** Constructs a fresh Controller-safe snapshot and never settles claimable positions. */
export function createBankView(input: CreateBankViewInput): BankClientView {
    const currentTurn = pageInteger(input.currentTurn, 0, 0, Number.MAX_SAFE_INTEGER, 'currentTurn');
    const offset = pageInteger(input.activityOffset, 0, 0, Number.MAX_SAFE_INTEGER, 'activityOffset');
    const limit = pageInteger(
        input.activityLimit,
        BANK_DEFAULT_ACTIVITY_PAGE_SIZE,
        1,
        BANK_MAX_ACTIVITY_PAGE_SIZE,
        'activityLimit',
    );
    const domain = input.domain ?? createEmptyBankDomain();
    validateBankDomain(domain);
    const state = replayBankEvents(domain);
    const records = flattenBankActivities(domain).reverse();
    const activities = records.slice(offset, offset + limit).map(publicActivity);
    return {
        revision: domain.events.length,
        eventId: domain.events.at(-1)?.eventId ?? '',
        currentTurn,
        lockedAmount: calculateBankLockedAmount(state),
        products: {
            deposits: listBankDepositProducts().map((product) => ({ ...product })),
            funds: listBankFundProducts().map((product) => ({
                ...product,
                returnRangeBps: { ...product.returnRangeBps },
            })),
        },
        deposits: state.openDeposits.map((position) => {
            const product = getBankDepositContract(position.productId);
            return {
                id: position.id,
                productId: position.productId,
                name: product.name,
                principal: position.principal,
                startTurn: position.startTurn,
                maturityTurn: position.maturityTurn,
                remainingTurns: Math.max(0, position.maturityTurn - currentTurn),
                claimable: currentTurn >= position.maturityTurn,
                maturityAmount: position.maturityAmount,
                earlyWithdrawalAmount: position.earlyWithdrawalAmount,
            };
        }),
        investments: state.openInvestments.map((position): BankFundPositionView => {
            const product = getBankFundContract(position.productId);
            const base = {
                id: position.id,
                productId: position.productId,
                name: product.name,
                description: product.description,
                riskLevel: product.riskLevel,
                principal: position.principal,
                startTurn: position.startTurn,
                maturityTurn: position.maturityTurn,
                remainingTurns: Math.max(0, position.maturityTurn - currentTurn),
            };
            if (currentTurn < position.maturityTurn) {return { ...base, claimable: false };}
            return {
                ...base,
                claimable: true,
                resolvedReturnBps: position.resolvedReturnBps,
                settlementAmount: position.settlementAmount,
            };
        }),
        activities,
        activityPage: {
            offset,
            limit,
            total: records.length,
            hasMore: offset + activities.length < records.length,
        },
    };
}

export const createBankPublicView = createBankView;
