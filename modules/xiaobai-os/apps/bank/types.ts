export type BankClientStatus = 'ready' | 'loading' | 'saving' | 'unconfirmed' | 'conflict' | 'blocked';
export type BankRiskView = 'low' | 'medium' | 'high';
export type BankPage = 'vault' | 'deposits' | 'funds' | 'positions' | 'records';

export interface BankDepositProductView {
    id: string;
    name: string;
    lockRounds: number;
    lockLabel: string;
    interestBps: number;
    interestLabel: string;
    earlyPenaltyBps: number;
    earlyPenaltyLabel: string;
    minAmount: number;
    maxAmount: number;
    amountLabel: string;
}

export interface BankFundProductView {
    id: string;
    name: string;
    description: string;
    lockRounds: number;
    lockLabel: string;
    returnMinBps: number;
    returnMaxBps: number;
    returnLabel: string;
    riskLevel: BankRiskView;
    riskLabel: string;
    minAmount: number;
    maxAmount: number;
    amountLabel: string;
}

export interface BankDepositPositionView {
    id: string;
    productId: string;
    name: string;
    principal: number;
    remainingTurns: number;
    maturityAmount: number;
    earlyWithdrawalAmount: number;
    claimable: boolean;
    status: 'locked' | 'claimable';
    statusLabel: string;
}

interface BankFundPositionBaseView {
    id: string;
    productId: string;
    name: string;
    description: string;
    riskLevel: BankRiskView;
    riskLabel: string;
    principal: number;
    remainingTurns: number;
}

export interface BankLockedFundPositionView extends BankFundPositionBaseView {
    claimable: false;
    status: 'locked';
    statusLabel: string;
}

export interface BankClaimableFundPositionView extends BankFundPositionBaseView {
    claimable: true;
    status: 'claimable';
    statusLabel: string;
    resolvedReturnBps: number;
    returnLabel: string;
    settlementAmount: number;
}

export type BankFundPositionView = BankLockedFundPositionView | BankClaimableFundPositionView;

export interface BankActivityView {
    id: string;
    kind: 'deposit' | 'fund';
    kindLabel: string;
    productName: string;
    resultLabel: string;
    amountIn: number;
    payout: number;
    net: number;
    netLabel: string;
    assistantTurn: number;
    turnLabel: string;
    createdAt: number;
}

export interface BankActivityPageView {
    activities: BankActivityView[];
    activityPage: {
        offset: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

export interface BankClientState extends BankActivityPageView {
    chatIdentity: string;
    currency: '小白币';
    balance: number;
    lockedAmount: number;
    currentTurn: number;
    revision: number;
    eventId: string;
    status: BankClientStatus;
    statusLabel: string;
    message: string;
    generationActive: boolean;
    claimableCount: number;
    products: {
        deposits: BankDepositProductView[];
        funds: BankFundProductView[];
    };
    deposits: BankDepositPositionView[];
    investments: BankFundPositionView[];
}
