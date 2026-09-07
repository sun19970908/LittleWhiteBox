import {
    throwBankError,
    type BankRandomSource,
} from './types.js';

function assertRandomBound(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwBankError('bank_random_invalid', `bound:${String(value)}`);
    }
    return value;
}

export function nextBankRandomInt(source: BankRandomSource, maxExclusive: number): number {
    const bound = assertRandomBound(maxExclusive);
    if (!source || typeof source.nextInt !== 'function') {
        throwBankError('bank_random_invalid', 'source');
    }
    const value = source.nextInt(bound);
    if (!Number.isSafeInteger(value) || value < 0 || value >= bound) {
        throwBankError('bank_random_invalid', `value:${String(value)}/${bound}`);
    }
    return value;
}

export function createValidatedBankRandomSource(source: BankRandomSource): BankRandomSource {
    if (!source || typeof source.nextInt !== 'function') {
        throwBankError('bank_random_invalid', 'source');
    }
    return Object.freeze({
        nextInt(maxExclusive: number): number {
            return nextBankRandomInt(source, maxExclusive);
        },
    });
}

export function createBankRandomSource(nextInt: BankRandomSource['nextInt']): BankRandomSource {
    if (typeof nextInt !== 'function') {throwBankError('bank_random_invalid', 'source');}
    return createValidatedBankRandomSource({ nextInt });
}

const rawMathRandomSource: BankRandomSource = {
    nextInt(maxExclusive: number): number {
        return Math.floor(Math.random() * maxExclusive);
    },
};

export const bankRandomSource = createValidatedBankRandomSource(rawMathRandomSource);

export function createBankSequenceRandom(
    values: readonly number[],
    options: { repeat?: boolean } = {},
): BankRandomSource {
    const sequence = [...values];
    let cursor = 0;
    return createBankRandomSource((_maxExclusive) => {
        if (sequence.length === 0 || (!options.repeat && cursor >= sequence.length)) {
            throwBankError('bank_random_exhausted');
        }
        const value = sequence[cursor % sequence.length];
        cursor += 1;
        if (value === undefined) {throwBankError('bank_random_exhausted');}
        return value;
    });
}

export function rollBankDie(source: BankRandomSource): 1 | 2 | 3 | 4 | 5 | 6 {
    return (nextBankRandomInt(source, 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

export function shuffleBankValues<T>(values: readonly T[], source: BankRandomSource): T[] {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const selected = nextBankRandomInt(source, index + 1);
        const current = shuffled[index];
        const replacement = shuffled[selected];
        if (current === undefined || replacement === undefined) {
            throwBankError('bank_random_invalid', 'shuffle-index');
        }
        shuffled[index] = replacement;
        shuffled[selected] = current;
    }
    return shuffled;
}

export function drawBankInclusiveInteger(min: number, max: number, source: BankRandomSource): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
        throwBankError('bank_random_invalid', `range:${String(min)}:${String(max)}`);
    }
    const size = max - min + 1;
    if (!Number.isSafeInteger(size) || size <= 0) {
        throwBankError('bank_random_invalid', `range-size:${String(size)}`);
    }
    return min + nextBankRandomInt(source, size);
}

export function drawBankProbabilityBasisPoints(source: BankRandomSource): number {
    return nextBankRandomInt(source, 10_000);
}
