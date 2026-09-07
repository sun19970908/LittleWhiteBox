import { throwGameError } from './types.js';

export const GAME_BASIS_POINTS = 10_000 as const;
export const GAME_MAX_PAYOUT = 50_000 as const;

export function assertPositiveGameAmount(value: unknown, detail = 'amount'): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwGameError('game_amount_invalid', detail);
    }
    return value;
}

export function assertGamePayout(value: unknown, detail = 'payout'): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throwGameError('game_amount_invalid', detail);
    }
    if (value > GAME_MAX_PAYOUT) {throwGameError('game_amount_overflow', detail);}
    return value;
}

function assertPositiveSafeFactor(value: unknown, detail: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwGameError('game_amount_invalid', detail);
    }
    return value;
}

export function multiplyGameAmount(amount: unknown, numerator: unknown, denominator: unknown): number {
    const base = assertPositiveGameAmount(amount);
    const multiplier = assertPositiveSafeFactor(numerator, 'numerator');
    const divisor = assertPositiveSafeFactor(denominator, 'denominator');
    if (base > Math.floor(Number.MAX_SAFE_INTEGER / multiplier)) {throwGameError('game_amount_overflow');}
    return assertGamePayout(Math.floor((base * multiplier) / divisor));
}

export function gameAmountAtBps(principal: unknown, bps: unknown): number {
    const amount = assertPositiveGameAmount(principal, 'principal');
    if (typeof bps !== 'number' || !Number.isSafeInteger(bps)) {throwGameError('game_amount_invalid', 'bps');}
    const multiplier = GAME_BASIS_POINTS + bps;
    if (!Number.isSafeInteger(multiplier) || multiplier < 0) {throwGameError('game_amount_invalid', 'bps');}
    if (multiplier === 0) {return 0;}
    return multiplyGameAmount(amount, multiplier, GAME_BASIS_POINTS);
}
