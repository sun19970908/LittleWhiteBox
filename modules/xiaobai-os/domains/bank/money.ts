import { throwBankError } from './types.js';

export const BANK_BASIS_POINTS = 10_000 as const;
export const BANK_MAX_PAYOUT = 50_000 as const;

export function assertPositiveBankAmount(value: unknown, detail = 'amount'): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwBankError('bank_amount_invalid', detail);
    }
    return value;
}

export function assertBankPayout(value: unknown, detail = 'payout'): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throwBankError('bank_amount_invalid', detail);
    }
    if (value > BANK_MAX_PAYOUT) {
        throwBankError('bank_amount_overflow', detail);
    }
    return value;
}

function assertPositiveSafeFactor(value: unknown, detail: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwBankError('bank_amount_invalid', detail);
    }
    return value;
}

export function multiplyBankAmount(
    amount: unknown,
    numerator: unknown,
    denominator: unknown,
): number {
    const base = assertPositiveBankAmount(amount);
    const multiplier = assertPositiveSafeFactor(numerator, 'numerator');
    const divisor = assertPositiveSafeFactor(denominator, 'denominator');
    if (base > Math.floor(Number.MAX_SAFE_INTEGER / multiplier)) {
        throwBankError('bank_amount_overflow');
    }
    return assertBankPayout(Math.floor((base * multiplier) / divisor));
}

export function amountAtBps(principal: unknown, bps: unknown): number {
    const amount = assertPositiveBankAmount(principal, 'principal');
    if (typeof bps !== 'number' || !Number.isSafeInteger(bps)) {
        throwBankError('bank_amount_invalid', 'bps');
    }
    const multiplier = BANK_BASIS_POINTS + bps;
    if (!Number.isSafeInteger(multiplier) || multiplier < 0) {
        throwBankError('bank_amount_invalid', 'bps');
    }
    if (multiplier === 0) {return 0;}
    return multiplyBankAmount(amount, multiplier, BANK_BASIS_POINTS);
}
