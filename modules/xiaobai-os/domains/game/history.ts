import { type GameActivity, type GameAction, type GameActiveGame, type GameChange, type GameEvent,
    type GameLadderTerminalStep, type GamePrivateDiceGame, type GamePrivateLadderGame,
    type GamePrivatePushGame, type GameState, throwGameError } from './types.js';

function invalid(detail: string): never {
    return throwGameError('game_invalid_domain', detail);
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function gameId(active: GameActiveGame): string {
    return active.game.id;
}

function activeBet(active: GameActiveGame): number {
    return active.game.bet;
}

function assertSameDiceBase(left: GamePrivateDiceGame, right: GamePrivateDiceGame): void {
    if (left.id !== right.id || left.bet !== right.bet || !sameJson(left.playerDice, right.playerDice)
        || !sameJson(left.dealerDice, right.dealerDice)) {invalid('event.dice-transition');}
}

function assertSamePushBase(left: GamePrivatePushGame, right: GamePrivatePushGame): void {
    if (left.id !== right.id || left.bet !== right.bet || !sameJson(left.deck, right.deck)) {
        invalid('event.push-transition');
    }
}

function assertSameLadderBase(left: GamePrivateLadderGame, right: GamePrivateLadderGame): void {
    if (left.id !== right.id || left.bet !== right.bet || left.riskBase !== right.riskBase) {
        invalid('event.ladder-transition');
    }
}

function terminalPrefix(game: GamePrivateLadderGame): GameLadderTerminalStep[] {
    return game.steps.map((step) => ({
        floor: step.floor,
        choice: step.choice,
        success: true,
        amountAfterStep: step.amountAfterSuccess,
    }));
}

function assertDiceActivity(active: GamePrivateDiceGame, command: GameAction, activity: GameActivity): void {
    if (activity.detail.kind !== 'dice' || !sameJson(activity.detail.playerDice, active.playerDice)
        || !sameJson(activity.detail.dealerDice, active.dealerDice)) {invalid('event.dice-activity');}
    const expectedBids = command.kind === 'dice-bid'
        ? [...active.bids, { by: 'player' as const, ...command.bid }]
        : active.bids;
    const expectedChallenger = command.kind === 'dice-bid' ? 'dealer' : 'player';
    if ((command.kind !== 'dice-bid' && command.kind !== 'dice-challenge')
        || !sameJson(activity.detail.bids, expectedBids)
        || activity.detail.challenger !== expectedChallenger
        || (activity.detail.outcome === 'dealer-win' && activity.payout !== 0)
        || (activity.detail.outcome === 'player-win' && activity.payout <= 0)) {
        invalid('event.dice-activity');
    }
}

function assertPushActivity(active: GamePrivatePushGame, command: GameAction, activity: GameActivity): void {
    if (activity.detail.kind !== 'push') {invalid('event.push-activity');}
    if (command.kind === 'push-cash-out') {
        if (active.revealedCoins < 1 || activity.detail.outcome !== 'cashed-out'
            || activity.detail.revealedCoins !== active.revealedCoins
            || activity.payout !== active.cashoutAmount) {
            invalid('event.push-activity');
        }
        return;
    }
    if (command.kind !== 'push-draw') {invalid('event.push-activity');}
    const nextCard = active.deck[active.drawIndex];
    if (nextCard === 'bomb') {
        if (activity.detail.outcome !== 'busted' || activity.detail.revealedCoins !== active.revealedCoins
            || activity.payout !== 0) {invalid('event.push-activity');}
        return;
    }
    const isLastCoin = !active.deck.slice(active.drawIndex + 1).includes('coin');
    if (nextCard !== 'coin' || !isLastCoin || activity.detail.outcome !== 'cleared'
        || activity.detail.revealedCoins !== active.revealedCoins + 1
        || activity.payout <= active.cashoutAmount) {
        invalid('event.push-activity');
    }
}

function assertLadderActivity(active: GamePrivateLadderGame, command: GameAction, activity: GameActivity): void {
    if (activity.detail.kind !== 'ladder') {invalid('event.ladder-activity');}
    const prefix = terminalPrefix(active);
    if (command.kind === 'ladder-cash-out') {
        const amount = active.steps.at(-1)?.amountAfterSuccess;
        if (amount === undefined || activity.detail.outcome !== 'cashed-out'
            || !sameJson(activity.detail.steps, prefix) || activity.payout !== amount) {
            invalid('event.ladder-activity');
        }
        return;
    }
    if (command.kind !== 'ladder-step' || activity.detail.steps.length !== prefix.length + 1
        || !sameJson(activity.detail.steps.slice(0, -1), prefix)) {invalid('event.ladder-activity');}
    const final = activity.detail.steps.at(-1);
    if (!final || final.floor !== prefix.length + 1 || final.choice !== command.choice) {
        invalid('event.ladder-activity');
    }
    if (!final.success) {
        if (final.amountAfterStep !== 0 || activity.detail.outcome !== 'failed' || activity.payout !== 0) {
            invalid('event.ladder-activity');
        }
        return;
    }
    if ((activity.detail.outcome !== 'cleared' && activity.detail.outcome !== 'capped')
        || final.amountAfterStep <= 0 || activity.payout !== final.amountAfterStep) {
        invalid('event.ladder-activity');
    }
}

function assertGameActivity(active: GameActiveGame, command: GameAction, activity: GameActivity): void {
    if (activity.sourceId !== gameId(active) || activity.amountIn !== activeBet(active)) {
        invalid('event.game-activity');
    }
    if (active.kind === 'dice') {assertDiceActivity(active.game, command, activity); return;}
    if (active.kind === 'push') {assertPushActivity(active.game, command, activity); return;}
    assertLadderActivity(active.game, command, activity);
}

function assertDiceTransition(active: GamePrivateDiceGame, command: GameAction, change: GameChange): void {
    if (change.kind === 'game-ended') {return;}
    if (change.kind !== 'game-advanced' || change.game.kind !== 'dice' || command.kind !== 'dice-bid') {
        invalid('event.dice-transition');
    }
    const next = change.game.game;
    assertSameDiceBase(active, next);
    if (next.bids.length !== active.bids.length + 2
        || !sameJson(next.bids.slice(0, -2), active.bids)
        || !sameJson(next.bids.at(-2), { by: 'player', ...command.bid })
        || next.bids.at(-1)?.by !== 'dealer') {
        invalid('event.dice-transition');
    }
}

function assertPushTransition(active: GamePrivatePushGame, command: GameAction, change: GameChange): void {
    if (change.kind === 'game-ended') {return;}
    if (change.kind !== 'game-advanced' || change.game.kind !== 'push' || command.kind !== 'push-draw') {
        invalid('event.push-transition');
    }
    const next = change.game.game;
    assertSamePushBase(active, next);
    if (active.deck[active.drawIndex] !== 'coin'
        || next.drawIndex !== active.drawIndex + 1
        || next.revealedCoins !== active.revealedCoins + 1
        || next.cashoutAmount <= active.cashoutAmount
        || !next.deck.slice(next.drawIndex).includes('coin')) {
        invalid('event.push-transition');
    }
}

function assertLadderTransition(active: GamePrivateLadderGame, command: GameAction, change: GameChange): void {
    if (change.kind === 'game-ended') {return;}
    if (change.kind !== 'game-advanced' || change.game.kind !== 'ladder' || command.kind !== 'ladder-step') {
        invalid('event.ladder-transition');
    }
    const next = change.game.game;
    assertSameLadderBase(active, next);
    const final = next.steps.at(-1);
    if (next.steps.length !== active.steps.length + 1
        || !sameJson(next.steps.slice(0, -1), active.steps)
        || !final || final.floor !== active.steps.length + 1
        || final.choice !== command.choice || final.amountAfterSuccess <= 0) {
        invalid('event.ladder-transition');
    }
}

function assertGameTransition(active: GameActiveGame, command: GameAction, change: GameChange): void {
    if (change.kind === 'game-ended' && change.gameId !== gameId(active)) {invalid('event.game-ended');}
    if (change.kind === 'game-advanced'
        && (change.game.kind !== active.kind || gameId(change.game) !== gameId(active))) {
        invalid('event.game-advanced');
    }
    if (active.kind === 'dice') {assertDiceTransition(active.game, command, change); return;}
    if (active.kind === 'push') {assertPushTransition(active.game, command, change); return;}
    assertLadderTransition(active.game, command, change);
}

function assertInitialGame(command: GameAction, active: GameActiveGame): void {
    const expectedKind = command.kind.slice(0, command.kind.indexOf('-'));
    if (active.kind !== expectedKind || gameId(active) !== command.gameId
        || ('bet' in command && activeBet(active) !== command.bet)
        || (active.kind === 'dice' && active.game.bids.length !== 0)
        || (active.kind === 'push' && (active.game.drawIndex !== 0
            || active.game.revealedCoins !== 0 || active.game.cashoutAmount !== 0))
        || (active.kind === 'ladder' && active.game.steps.length !== 0)) {
        invalid('event.game-started');
    }
}

function applyHistoricalEvent(
    state: GameState,
    event: GameEvent,
    gameIds: Set<string>,
    activityIds: Set<string>,
    activitySourceIds: Set<string>,
): void {
    const { command } = event;
    const { changes, activities } = event.result;
    if (changes.length !== 1) {invalid('event.changes');}
    const change = changes[0] as GameChange;
    let gameEnded = false;
    if (command.kind === 'dice-start' || command.kind === 'push-start' || command.kind === 'ladder-start') {
        if (change.kind !== 'game-started' || state.activeGame || activities.length !== 0) {
            invalid('event.game-started');
        }
        assertInitialGame(command, change.game);
        if (gameIds.has(gameId(change.game))) {invalid('event.game-id');}
        gameIds.add(gameId(change.game));
        state.activeGame = structuredClone(change.game);
    } else {
        const active = state.activeGame;
        if (!active || gameId(active) !== command.gameId || command.kind.split('-')[0] !== active.kind) {
            invalid('event.game-action');
        }
        assertGameTransition(active, command, change);
        if (change.kind === 'game-ended') {
            if (activities.length !== 1) {invalid('event.activities');}
            assertGameActivity(active, command, activities[0] as GameActivity);
            delete state.activeGame;
            gameEnded = true;
        } else {
            state.activeGame = structuredClone(change.game);
        }
    }
    if (activities.length !== Number(gameEnded)) {invalid('event.activities');}
    for (const activity of activities) {
        if (activityIds.has(activity.id) || activitySourceIds.has(activity.sourceId)
            || !gameIds.has(activity.sourceId)) {invalid('event.activity-id');}
        activityIds.add(activity.id);
        activitySourceIds.add(activity.sourceId);
    }
}

/** Validates only V1 lifecycle and frozen event facts; product policy belongs to new commands. */
export function validateGameHistory(events: readonly GameEvent[]): void {
    const gameIds = new Set<string>();
    const activityIds = new Set<string>();
    const activitySourceIds = new Set<string>();
    const state: GameState = {};
    for (const event of events) {
        applyHistoricalEvent(state, event, gameIds, activityIds, activitySourceIds);
    }
}
