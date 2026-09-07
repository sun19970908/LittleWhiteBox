export const ECONOMY_SCHEMA_VERSION = 2 as const;
export const OPENING_GRANT_AMOUNT = 100 as const;
export const OPENING_GRANT_ACTION_ID = 'economy:opening-grant:v1';
export const OPENING_GRANT_IDEMPOTENCY_KEY = 'economy:opening-grant:v1';

export interface EconomyTransaction {
    id: string;
    sequence: number;
    idempotencyKey: string;
    actionId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    kind: string;
    title: string;
    note: string;
    sourceDomain: string;
    sourceId: string;
    createdAt: number;
    reversalOfTransactionId?: string;
}

export interface EconomyLedgerV2 {
    schemaVersion: typeof ECONOMY_SCHEMA_VERSION;
    transactions: EconomyTransaction[];
}

export interface PostTransactionInput {
    idempotencyKey: string;
    actionId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    kind: string;
    title: string;
    note?: string;
    sourceDomain: string;
    sourceId: string;
    reversalOfTransactionId?: string;
}

export interface ReverseTransactionInput {
    transactionId: string;
    idempotencyKey: string;
    actionId: string;
    title: string;
    note?: string;
    sourceDomain: string;
    sourceId: string;
}

export interface EconomyPostResult {
    ledger: EconomyLedgerV2;
    transaction: EconomyTransaction;
    created: boolean;
}

export interface EconomyPostActionResult {
    ledger: EconomyLedgerV2;
    transactions: EconomyTransaction[];
    created: boolean;
}

export interface EconomyTransactionPage {
    transactions: EconomyTransaction[];
    nextCursor: number | null;
    hasMore: boolean;
}

export class EconomyError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'EconomyError';
        this.code = code;
    }
}
