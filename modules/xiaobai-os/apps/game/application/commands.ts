import {
    challengeGameDiceGame,
    createGameDiceGame,
    isGameDiceBidHigher,
    normalizeGameDiceBet,
    normalizeGameDiceBid,
    respondToGameDicePlayerBid,
} from '../../../domains/game/games/dice-bluff.js';
import {
    GAME_PUSH_BET,
    cashOutGamePushGame,
    createGamePushGame,
    drawGamePushCard,
} from '../../../domains/game/games/push-your-luck.js';
import {
    cashOutGameLadderGame,
    createGameLadderGame,
    getGameLadderOption,
    normalizeGameLadderBet,
    stepGameLadderGame,
} from '../../../domains/game/games/risk-ladder.js';
import {
    throwGameError,
    type GameAction,
    type GameRandomSource,
} from '../../../domains/game/types.js';
import {
    assertNoActiveGame,
    assertPlayerFunds,
    continuedResult,
    requireActiveGame,
    terminalAction,
} from './action-policy.js';
import { startGameStakeLeg } from './economy-protocol.js';
import type {
    GameBidDiceCommand,
    GameCommand,
    GameServiceCommand,
    GameServiceView,
    GameStartDiceCommand,
    GameStartLadderCommand,
    GameStepLadderCommand,
    PreparedGameContext,
    RunGameAction,
} from './service.js';

interface GameCommandDependencies {
    random: GameRandomSource;
    runAction: RunGameAction;
    unusedGameId: (prepared: PreparedGameContext, kind: 'dice' | 'push' | 'ladder') => string;
}

export function createGameCommands({ random, runAction, unusedGameId }: GameCommandDependencies) {
    function startDice(input: GameStartDiceCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'dice-start', bet: input.bet }, (prepared) => {
            assertNoActiveGame(prepared.state);
            const bet = normalizeGameDiceBet(input.bet);
            assertPlayerFunds(prepared.balance, bet);
            const game = createGameDiceGame({ id: unusedGameId(prepared, 'dice'), bet }, random);
            const command: GameAction = { kind: 'dice-start', gameId: game.id, bet };
            return {
                command,
                result: { changes: [{ kind: 'game-started', game: { kind: 'dice', game } }], activities: [] },
                economyLegs: [startGameStakeLeg(game.id, bet)],
            };
        });
    }

    function bidDice(input: GameBidDiceCommand): Promise<GameServiceView> {
        return runAction(input, {
            kind: 'dice-bid',
            gameId: input.gameId,
            count: input.bid?.count,
            face: input.bid?.face,
        }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'dice', input.gameId);
            if (active.kind !== 'dice') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            const bid = normalizeGameDiceBid(input.bid, 'player');
            const previous = active.game.bids.at(-1);
            if (previous && !isGameDiceBidHigher(bid, previous)) {throwGameError('game_dice_bid_not_higher');}
            const transition = respondToGameDicePlayerBid(active.game, bid, random);
            const command: GameAction = {
                kind: 'dice-bid',
                gameId: active.game.id,
                bid: { count: bid.count, face: bid.face },
            };
            if (transition.kind === 'continued') {
                return {
                    command,
                    result: continuedResult({ kind: 'dice', game: transition.game }),
                    economyLegs: [],
                };
            }
            return {
                command,
                ...terminalAction({ kind: 'dice', settlement: transition.settlement }, active.game.bet, activityId),
            };
        });
    }

    function challengeDice(input: GameCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'dice-challenge', gameId: input.gameId }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'dice', input.gameId);
            if (active.kind !== 'dice') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            if (!active.game.bids.at(-1)) {throwGameError('game_dice_challenge_invalid');}
            const settlement = challengeGameDiceGame(active.game);
            return {
                command: { kind: 'dice-challenge', gameId: active.game.id },
                ...terminalAction({ kind: 'dice', settlement }, active.game.bet, activityId),
            };
        });
    }

    function startPush(input: GameServiceCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'push-start' }, (prepared) => {
            assertNoActiveGame(prepared.state);
            assertPlayerFunds(prepared.balance, GAME_PUSH_BET);
            const game = createGamePushGame({ id: unusedGameId(prepared, 'push') }, random);
            const command: GameAction = { kind: 'push-start', gameId: game.id };
            return {
                command,
                result: { changes: [{ kind: 'game-started', game: { kind: 'push', game } }], activities: [] },
                economyLegs: [startGameStakeLeg(game.id, GAME_PUSH_BET)],
            };
        });
    }

    function drawPush(input: GameCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'push-draw', gameId: input.gameId }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'push', input.gameId);
            if (active.kind !== 'push') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            const transition = drawGamePushCard(active.game);
            const command: GameAction = { kind: 'push-draw', gameId: active.game.id };
            if (transition.kind === 'continued') {
                return {
                    command,
                    result: continuedResult({ kind: 'push', game: transition.game }),
                    economyLegs: [],
                };
            }
            return {
                command,
                ...terminalAction({ kind: 'push', settlement: transition.settlement }, active.game.bet, activityId),
            };
        });
    }

    function cashOutPush(input: GameCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'push-cash-out', gameId: input.gameId }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'push', input.gameId);
            if (active.kind !== 'push') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            if (active.game.revealedCoins < 1) {throwGameError('game_push_cashout_invalid');}
            const settlement = cashOutGamePushGame(active.game);
            return {
                command: { kind: 'push-cash-out', gameId: active.game.id },
                ...terminalAction({ kind: 'push', settlement }, active.game.bet, activityId),
            };
        });
    }

    function startLadder(input: GameStartLadderCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'ladder-start', bet: input.bet }, (prepared) => {
            assertNoActiveGame(prepared.state);
            const bet = normalizeGameLadderBet(input.bet);
            assertPlayerFunds(prepared.balance, bet);
            const game = createGameLadderGame({ id: unusedGameId(prepared, 'ladder'), bet });
            const command: GameAction = { kind: 'ladder-start', gameId: game.id, bet };
            return {
                command,
                result: { changes: [{ kind: 'game-started', game: { kind: 'ladder', game } }], activities: [] },
                economyLegs: [startGameStakeLeg(game.id, bet)],
            };
        });
    }

    function stepLadder(input: GameStepLadderCommand): Promise<GameServiceView> {
        return runAction(input, {
            kind: 'ladder-step',
            gameId: input.gameId,
            choice: input.choice,
        }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'ladder', input.gameId);
            if (active.kind !== 'ladder') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            getGameLadderOption(input.choice);
            const transition = stepGameLadderGame(active.game, input.choice, random);
            const command: GameAction = { kind: 'ladder-step', gameId: active.game.id, choice: input.choice };
            if (transition.kind === 'continued') {
                return {
                    command,
                    result: continuedResult({ kind: 'ladder', game: transition.game }),
                    economyLegs: [],
                };
            }
            return {
                command,
                ...terminalAction(
                    { kind: 'ladder', settlement: transition.settlement },
                    active.game.bet,
                    activityId,
                ),
            };
        });
    }

    function cashOutLadder(input: GameCommand): Promise<GameServiceView> {
        return runAction(input, { kind: 'ladder-cash-out', gameId: input.gameId }, (prepared, activityId) => {
            const active = requireActiveGame(prepared.state, 'ladder', input.gameId);
            if (active.kind !== 'ladder') {throwGameError('game_action_invalid', 'game-type-mismatch');}
            if (active.game.steps.length < 1) {throwGameError('game_ladder_cashout_invalid');}
            const settlement = cashOutGameLadderGame(active.game);
            return {
                command: { kind: 'ladder-cash-out', gameId: active.game.id },
                ...terminalAction({ kind: 'ladder', settlement }, active.game.bet, activityId),
            };
        });
    }

    return Object.freeze({
        startDice,
        bidDice,
        challengeDice,
        startPush,
        drawPush,
        cashOutPush,
        startLadder,
        stepLadder,
        cashOutLadder,
    });
}
