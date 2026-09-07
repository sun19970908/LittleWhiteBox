import {
    throwGameError,
    type GameDieFace,
    type GameRandomSource,
} from './types.js';

function assertRandomBound(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throwGameError('game_random_invalid', `bound:${String(value)}`);
    }
    return value;
}

export function nextGameRandomInt(source: GameRandomSource, maxExclusive: number): number {
    const bound = assertRandomBound(maxExclusive);
    if (!source || typeof source.nextInt !== 'function') {throwGameError('game_random_invalid', 'source');}
    const value = source.nextInt(bound);
    if (!Number.isSafeInteger(value) || value < 0 || value >= bound) {
        throwGameError('game_random_invalid', `value:${String(value)}/${bound}`);
    }
    return value;
}

export function createValidatedGameRandomSource(source: GameRandomSource): GameRandomSource {
    if (!source || typeof source.nextInt !== 'function') {throwGameError('game_random_invalid', 'source');}
    return Object.freeze({
        nextInt(maxExclusive: number): number {
            return nextGameRandomInt(source, maxExclusive);
        },
    });
}

export function createGameRandomSource(nextInt: GameRandomSource['nextInt']): GameRandomSource {
    if (typeof nextInt !== 'function') {throwGameError('game_random_invalid', 'source');}
    return createValidatedGameRandomSource({ nextInt });
}

const rawMathRandomSource: GameRandomSource = {
    nextInt(maxExclusive: number): number {
        return Math.floor(Math.random() * maxExclusive);
    },
};

export const gameRandomSource = createValidatedGameRandomSource(rawMathRandomSource);

export function createGameSequenceRandom(
    values: readonly number[],
    options: { repeat?: boolean } = {},
): GameRandomSource {
    const sequence = [...values];
    let cursor = 0;
    return createGameRandomSource((_maxExclusive) => {
        if (sequence.length === 0 || (!options.repeat && cursor >= sequence.length)) {
            throwGameError('game_random_exhausted');
        }
        const value = sequence[cursor % sequence.length];
        cursor += 1;
        if (value === undefined) {throwGameError('game_random_exhausted');}
        return value;
    });
}

export function rollGameDie(source: GameRandomSource): GameDieFace {
    return (nextGameRandomInt(source, 6) + 1) as GameDieFace;
}

export function shuffleGameValues<T>(values: readonly T[], source: GameRandomSource): T[] {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const selected = nextGameRandomInt(source, index + 1);
        const current = shuffled[index];
        const replacement = shuffled[selected];
        if (current === undefined || replacement === undefined) {
            throwGameError('game_random_invalid', 'shuffle-index');
        }
        shuffled[index] = replacement;
        shuffled[selected] = current;
    }
    return shuffled;
}

export function drawGameProbabilityBasisPoints(source: GameRandomSource): number {
    return nextGameRandomInt(source, GAME_PROBABILITY_BASIS_POINTS);
}

const GAME_PROBABILITY_BASIS_POINTS = 10_000;
