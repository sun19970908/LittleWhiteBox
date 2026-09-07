export type WalletStatus = 'ready' | 'loading' | 'saving' | 'unconfirmed' | 'conflict' | 'blocked';

export type WalletTransactionDirection = 'income' | 'expense' | 'transfer';

export interface WalletTransactionView {
    id: string;
    sequence: number;
    title: string;
    note: string;
    source: string;
    sourceDomain: string;
    amount: number;
    direction: WalletTransactionDirection;
    createdAt: number;
}

export interface WalletTransactionPageView {
    transactions: WalletTransactionView[];
    nextCursor: number | null;
    hasMore: boolean;
}

export interface WalletClientState extends WalletTransactionPageView {
    chatIdentity: string;
    currency: '小白币';
    balance: number;
    transactionCount: number;
    status: WalletStatus;
    message: string;
}
