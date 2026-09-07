import { assertPositiveGameAmount, GAME_MAX_PAYOUT, multiplyGameAmount } from '../money.js';
import { drawGameProbabilityBasisPoints } from '../random.js';
import {
    throwGameError,
    type GameLadderAction,
    type GameLadderChoice,
    type GameLadderChoiceView,
    type GameLadderGameView,
    type GameLadderSettlement,
    type GameLadderSuccessStep,
    type GameLadderTerminalStep,
    type GameLadderTransition,
    type GamePrivateLadderGame,
    type GameRandomSource,
} from '../types.js';

export const GAME_LADDER_MIN_BET = 30 as const;
export const GAME_LADDER_MAX_BET = 800 as const;
export const GAME_LADDER_BET_STEP = 10 as const;
export const GAME_LADDER_MAX_FLOORS = 5 as const;
export const GAME_LADDER_PAYOUT_CAP = GAME_MAX_PAYOUT;

export interface GameLadderOption {
    choice: GameLadderChoice;
    successProbabilityBps: number;
    numerator: number;
    denominator: number;
}

const GAME_LADDER_OPTIONS: readonly Readonly<GameLadderOption>[] = Object.freeze([
    Object.freeze({ choice: 'safe', successProbabilityBps: 8_000, numerator: 5, denominator: 4 }),
    Object.freeze({ choice: 'medium', successProbabilityBps: 5_500, numerator: 20, denominator: 11 }),
    Object.freeze({ choice: 'risky', successProbabilityBps: 3_000, numerator: 10, denominator: 3 }),
]);

export interface CreateGameLadderGameInput {
    id: string;
    bet: number;
}

function assertGameId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {throwGameError('game_id_required');}
    return value.trim();
}

export function normalizeGameLadderBet(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)
        || value < GAME_LADDER_MIN_BET || value > GAME_LADDER_MAX_BET
        || value % GAME_LADDER_BET_STEP !== 0) {
        throwGameError('game_amount_out_of_range', 'ladder-bet');
    }
    return value;
}

export function getGameLadderOption(choice: GameLadderChoice): Readonly<GameLadderOption> {
    const option = GAME_LADDER_OPTIONS.find((candidate) => candidate.choice === choice);
    if (!option) {throwGameError('game_ladder_choice_invalid');}
    return option;
}

export function listGameLadderOptions(): readonly Readonly<GameLadderOption>[] {
    return GAME_LADDER_OPTIONS;
}

export function calculateGameLadderRiskBase(bet: unknown): number {
    return multiplyGameAmount(normalizeGameLadderBet(bet), 9, 10);
}

export function calculateGameLadderSuccessAmount(
    currentAmount: number,
    choice: GameLadderChoice,
): number {
    const option = getGameLadderOption(choice);
    if (!Number.isSafeInteger(currentAmount) || currentAmount <= 0 || currentAmount > GAME_MAX_PAYOUT) {
        throwGameError('game_invalid', 'ladder-current-amount');
    }
    const capThreshold = Math.ceil((GAME_MAX_PAYOUT * option.denominator) / option.numerator);
    if (currentAmount >= capThreshold) {return GAME_MAX_PAYOUT;}
    return multiplyGameAmount(currentAmount, option.numerator, option.denominator);
}

export function createGameLadderGame(input: CreateGameLadderGameInput): GamePrivateLadderGame {
    const id = assertGameId(input.id);
    const bet = normalizeGameLadderBet(input.bet);
    return {
        id,
        bet,
        riskBase: calculateGameLadderRiskBase(bet),
        steps: [],
    };
}

function currentLadderAmount(game: GamePrivateLadderGame): number {
    return game.steps.at(-1)?.amountAfterSuccess ?? game.riskBase;
}

export function assertActiveGameLadderGame(game: GamePrivateLadderGame): void {
    if (!game || typeof game !== 'object') {throwGameError('game_invalid', 'ladder-game');}
    assertGameId(game.id);
    assertPositiveGameAmount(game.bet, 'ladder-bet');
    assertPositiveGameAmount(game.riskBase, 'ladder-risk-base');
    if (!Array.isArray(game.steps)) {
        throwGameError('game_invalid', 'ladder-game');
    }
    for (let index = 0; index < game.steps.length; index += 1) {
        const step = game.steps[index];
        if (!step || step.floor !== index + 1
            || !GAME_LADDER_OPTIONS.some(option => option.choice === step.choice)) {
            throwGameError('game_invalid', 'ladder-step');
        }
        assertPositiveGameAmount(step.amountAfterSuccess, 'ladder-step-amount');
    }
}

function terminalSteps(game: GamePrivateLadderGame): GameLadderTerminalStep[] {
    return game.steps.map((step) => ({
        floor: step.floor,
        choice: step.choice,
        success: true,
        amountAfterStep: step.amountAfterSuccess,
    }));
}

function createLadderSettlement(
    game: GamePrivateLadderGame,
    outcome: GameLadderSettlement['outcome'],
    payout: number,
    steps: GameLadderTerminalStep[],
): GameLadderSettlement {
    return {
        gameId: game.id,
        outcome,
        payout,
        steps: steps.map((step) => ({ ...step })),
    };
}

export function stepGameLadderGame(
    game: GamePrivateLadderGame,
    choice: GameLadderChoice,
    random: GameRandomSource,
): GameLadderTransition {
    assertActiveGameLadderGame(game);
    if (game.steps.length >= GAME_LADDER_MAX_FLOORS) {throwGameError('game_invalid', 'ladder-max-floors');}
    const option = getGameLadderOption(choice);
    const floor = game.steps.length + 1;
    const success = drawGameProbabilityBasisPoints(random) < option.successProbabilityBps;
    if (!success) {
        return {
            kind: 'settled',
            settlement: createLadderSettlement(game, 'failed', 0, [
                ...terminalSteps(game),
                { floor, choice, success: false, amountAfterStep: 0 },
            ]),
        };
    }

    const amountAfterSuccess = calculateGameLadderSuccessAmount(currentLadderAmount(game), choice);
    const step: GameLadderSuccessStep = { floor, choice, amountAfterSuccess };
    const completedSteps = [...terminalSteps(game), {
        floor,
        choice,
        success: true,
        amountAfterStep: amountAfterSuccess,
    }];
    if (amountAfterSuccess === GAME_MAX_PAYOUT) {
        return {
            kind: 'settled',
            settlement: createLadderSettlement(game, 'capped', amountAfterSuccess, completedSteps),
        };
    }
    if (floor === GAME_LADDER_MAX_FLOORS) {
        return {
            kind: 'settled',
            settlement: createLadderSettlement(game, 'cleared', amountAfterSuccess, completedSteps),
        };
    }
    return {
        kind: 'continued',
        game: {
            id: game.id,
            bet: game.bet,
            riskBase: game.riskBase,
            steps: [...game.steps.map((historyStep) => ({ ...historyStep })), step],
        },
        step: { ...step },
    };
}

export function cashOutGameLadderGame(game: GamePrivateLadderGame): GameLadderSettlement {
    assertActiveGameLadderGame(game);
    if (game.steps.length < 1) {throwGameError('game_ladder_cashout_invalid');}
    return createLadderSettlement(game, 'cashed-out', currentLadderAmount(game), terminalSteps(game));
}

export function advanceGameLadderGame(
    game: GamePrivateLadderGame,
    action: GameLadderAction,
    random: GameRandomSource,
): GameLadderTransition {
    if (!action || typeof action !== 'object') {throwGameError('game_action_invalid', 'ladder-action');}
    if (action.kind === 'step') {return stepGameLadderGame(game, action.choice, random);}
    if (action.kind === 'cash-out') {
        return { kind: 'settled', settlement: cashOutGameLadderGame(game) };
    }
    throwGameError('game_action_invalid', 'ladder-action');
}

export function createGameLadderGameView(game: GamePrivateLadderGame): GameLadderGameView {
    assertActiveGameLadderGame(game);
    const cashoutAmount = currentLadderAmount(game);
    const nextChoices: GameLadderChoiceView[] = game.steps.length >= GAME_LADDER_MAX_FLOORS ? [] : GAME_LADDER_OPTIONS.map((option) => ({
        choice: option.choice,
        successProbabilityBps: option.successProbabilityBps,
        successAmount: calculateGameLadderSuccessAmount(cashoutAmount, option.choice),
    }));
    return {
        kind: 'ladder',
        id: game.id,
        bet: game.bet,
        riskBase: game.riskBase,
        completedFloors: game.steps.length,
        cashoutAmount,
        canCashOut: game.steps.length > 0,
        steps: game.steps.map((step) => ({ ...step })),
        nextChoices,
        legalActions: game.steps.length >= GAME_LADDER_MAX_FLOORS
            ? ['cash-out']
            : (game.steps.length > 0 ? ['step', 'cash-out'] : ['step']),
    };
}
