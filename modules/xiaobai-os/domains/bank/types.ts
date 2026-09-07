export const BANK_SCHEMA_VERSION = 1 as const;

export type BankDepositProductId = 'short-term' | 'mid-term' | 'long-term';
export type BankFundProductId = 'steady-fund' | 'growth-fund' | 'venture-fund';
export type BankProductId = BankDepositProductId | BankFundProductId;
export type BankRiskLevel = 'low' | 'medium' | 'high';

export interface BankDepositProduct {
    id: BankDepositProductId;
    name: string;
    lockRounds: number;
    interestBps: number;
    earlyPenaltyBps: number;
    minAmount: number;
    maxAmount: number;
}

export interface BankFundProduct {
    id: BankFundProductId;
    name: string;
    description: string;
    lockRounds: number;
    returnRangeBps: Readonly<{
        min: number;
        max: number;
    }>;
    riskLevel: BankRiskLevel;
    minAmount: number;
    maxAmount: number;
}

export interface BankDepositFrozenContract {
    readonly maturityAmount: number;
    readonly earlyWithdrawalAmount: number;
}

export interface BankFundFrozenContract {
    readonly resolvedReturnBps: number;
    readonly settlementAmount: number;
}

export type BankDepositContract = BankDepositFrozenContract;
export type BankFundContract = BankFundFrozenContract;

export interface BankDepositPosition extends BankDepositFrozenContract {
    id: string;
    productId: BankDepositProductId;
    principal: number;
    startTurn: number;
    maturityTurn: number;
}

export interface BankFundPosition extends BankFundFrozenContract {
    id: string;
    productId: BankFundProductId;
    principal: number;
    startTurn: number;
    maturityTurn: number;
}

export interface BankState {
    openDeposits: BankDepositPosition[];
    openInvestments: BankFundPosition[];
}

export type BankDepositActivityDetail = {
    kind: 'deposit';
    productId: BankDepositProductId;
    outcome: 'matured' | 'withdrawn-early';
};

export type BankFundActivityDetail = {
    kind: 'fund';
    productId: BankFundProductId;
    resolvedReturnBps: number;
};

export type BankActivityDetail =
    | BankDepositActivityDetail
    | BankFundActivityDetail;

export interface BankActivity {
    id: string;
    sourceId: string;
    detail: BankActivityDetail;
    amountIn: number;
    payout: number;
    net: number;
}

export interface BankActivityRecord extends BankActivity {
    revision: number;
    eventId: string;
    actionId: string;
    assistantTurn: number;
    createdAt: number;
}

export type BankAction =
    | { kind: 'deposit-open'; productId: BankDepositProductId; positionId: string; amount: number; settledPositionIds: string[] }
    | { kind: 'deposit-withdraw-early'; positionId: string; settledPositionIds: string[] }
    | { kind: 'fund-open'; productId: BankFundProductId; positionId: string; amount: number; settledPositionIds: string[] }
    | { kind: 'settle-due'; settledPositionIds: string[] };

export type BankChange =
    | { kind: 'deposit-opened'; position: BankDepositPosition }
    | { kind: 'fund-opened'; position: BankFundPosition }
    | { kind: 'positions-closed'; positionIds: string[] };

export interface BankEventResult {
    changes: BankChange[];
    activities: BankActivity[];
}

export interface BankEvent {
    revision: number;
    eventId: string;
    actionId: string;
    command: BankAction;
    result: BankEventResult;
    assistantTurn: number;
    createdAt: number;
}

export interface BankDomainV1 {
    schemaVersion: typeof BANK_SCHEMA_VERSION;
    events: BankEvent[];
}

export interface BankCasToken {
    expectedRevision: number;
    expectedEventId: string;
}

export interface BankAppendEventInput extends BankCasToken {
    eventId: string;
    actionId: string;
    command: BankAction;
    result: BankEventResult;
    assistantTurn: number;
    createdAt: number;
}

export interface BankCommandResult {
    domain: BankDomainV1;
    event: BankEvent;
    state: BankState;
    created: boolean;
}

export interface BankDepositPositionView {
    id: string;
    productId: BankDepositProductId;
    name: string;
    principal: number;
    startTurn: number;
    maturityTurn: number;
    remainingTurns: number;
    claimable: boolean;
    maturityAmount: number;
    earlyWithdrawalAmount: number;
}

interface BankFundPositionViewBase {
    id: string;
    productId: BankFundProductId;
    name: string;
    description: string;
    riskLevel: BankRiskLevel;
    principal: number;
    startTurn: number;
    maturityTurn: number;
    remainingTurns: number;
}

export interface BankLockedFundPositionView extends BankFundPositionViewBase {
    claimable: false;
}

export interface BankClaimableFundPositionView extends BankFundPositionViewBase {
    claimable: true;
    resolvedReturnBps: number;
    settlementAmount: number;
}

export type BankFundPositionView = BankLockedFundPositionView | BankClaimableFundPositionView;

export type BankPublicActivityRecord = BankActivityRecord;

export interface BankActivityPage {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface BankClientView {
    revision: number;
    eventId: string;
    currentTurn: number;
    lockedAmount: number;
    products: {
        deposits: BankDepositProduct[];
        funds: BankFundProduct[];
    };
    deposits: BankDepositPositionView[];
    investments: BankFundPositionView[];
    activities: BankPublicActivityRecord[];
    activityPage: BankActivityPage;
}

export interface BankRandomSource {
    nextInt(maxExclusive: number): number;
}

export type BankErrorCode =
    | 'bank_action_required'
    | 'bank_action_conflict'
    | 'bank_revision_conflict'
    | 'bank_event_id_conflict'
    | 'bank_invalid_context'
    | 'bank_invalid_domain'
    | 'bank_unsupported_version'
    | 'bank_product_id_required'
    | 'bank_product_missing'
    | 'bank_product_invalid'
    | 'bank_amount_invalid'
    | 'bank_amount_out_of_range'
    | 'bank_amount_overflow'
    | 'bank_position_missing'
    | 'bank_position_state_changed'
    | 'bank_no_due_positions'
    | 'bank_economy_inconsistent'
    | 'bank_random_invalid'
    | 'bank_random_exhausted';

export class BankError extends Error {
    readonly code: BankErrorCode;

    constructor(code: BankErrorCode, detail = '') {
        super(detail ? `${code}:${detail}` : code);
        this.name = 'BankError';
        this.code = code;
    }
}

export function throwBankError(code: BankErrorCode, detail = ''): never {
    throw new BankError(code, detail);
}
