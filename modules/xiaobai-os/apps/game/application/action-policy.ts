import { EconomyError } from '../../../domains/economy/types.js';
import {
    throwGameError,
    type GameAction,
    type GameActivity,
    type GameCasToken,
    type GameDomainV1,
    type GameEvent,
    type GameEventResult,
    type GameState,
    type GameTerminalResult,
} from '../../../domains/game/types.js';
import {
    gameSettlementLegs,
    type GameEconomyLeg,
} from './economy-protocol.js';
const ECONOMY_ACCOUNT_ID_PART_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export interface PreparedGameAction {
    command: GameAction;
    result: GameEventResult;
    economyLegs: GameEconomyLeg[];
}

export type GameExplicitIntent =
    | { kind: 'dice-start'; bet: unknown }
    | { kind: 'dice-bid'; gameId: unknown; count: unknown; face: unknown }
    | { kind: 'dice-challenge'; gameId: unknown }
    | { kind: 'push-start' }
    | { kind: 'push-draw'; gameId: unknown }
    | { kind: 'push-cash-out'; gameId: unknown }
    | { kind: 'ladder-start'; bet: unknown }
    | { kind: 'ladder-step'; gameId: unknown; choice: unknown }
    | { kind: 'ladder-cash-out'; gameId: unknown };
export function requireActionId(value: unknown): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > 200 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
        throwGameError('game_action_required');
    }
    return value;
}

export function requireGameId(value: unknown): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > 200 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
        throwGameError('game_id_required');
    }
    return value;
}

export function requireGeneratedId(value: unknown, detail: string, accountSafe = false): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > 200 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
        || (accountSafe && !ECONOMY_ACCOUNT_ID_PART_PATTERN.test(value))) {
        throwGameError('game_invalid_context', detail);
    }
    return value;
}

export function assertCas(domain: GameDomainV1, input: GameCasToken): void {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
        || typeof input.expectedEventId !== 'string'
        || input.expectedEventId !== input.expectedEventId.trim()
        || Array.from(input.expectedEventId).length > 200
        || /[\u0000-\u001f\u007f-\u009f]/u.test(input.expectedEventId)
        || (input.expectedRevision === 0) !== (input.expectedEventId === '')) {
        throwGameError('game_invalid_context', 'cas');
    }
    if (input.expectedRevision !== domain.events.length) {throwGameError('game_revision_conflict');}
    if (input.expectedEventId !== (domain.events.at(-1)?.eventId ?? '')) {
        throwGameError('game_event_id_conflict');
    }
}

function eventMatchesIntent(event: GameEvent, intent: GameExplicitIntent): boolean {
    const command = event.command;
    if (command.kind !== intent.kind) {return false;}
    if (intent.kind === 'dice-start' || intent.kind === 'ladder-start') {
        return command.kind === intent.kind && command.bet === intent.bet;
    }
    if (intent.kind === 'push-start') {return true;}
    if (intent.kind === 'dice-bid') {
        return command.kind === intent.kind && command.gameId === intent.gameId
            && command.bid.count === intent.count && command.bid.face === intent.face;
    }
    if (intent.kind === 'ladder-step') {
        return command.kind === intent.kind && command.gameId === intent.gameId && command.choice === intent.choice;
    }
    return command.gameId === intent.gameId;
}

export function replayExistingAction(
    domain: GameDomainV1,
    actionId: unknown,
    intent: GameExplicitIntent,
): GameEvent | null {
    const existing = domain.events.find((event) => event.actionId === actionId);
    if (!existing) {return null;}
    if (!eventMatchesIntent(existing, intent)) {throwGameError('game_action_conflict');}
    return existing;
}

export function assertNoActiveGame(state: GameState): void {
    if (state.activeGame) {throwGameError('game_action_invalid', 'active-game-exists');}
}

export function requireActiveGame(
    state: GameState,
    expectedKind: NonNullable<GameState['activeGame']>['kind'],
    gameIdValue: unknown,
): NonNullable<GameState['activeGame']> {
    const gameId = requireGameId(gameIdValue);
    const active = state.activeGame;
    if (!active) {throwGameError('game_action_invalid', 'active-game-missing');}
    if (active.game.id !== gameId) {throwGameError('game_action_invalid', 'game-id-mismatch');}
    if (active.kind !== expectedKind) {throwGameError('game_action_invalid', 'game-type-mismatch');}
    return active;
}

export function assertPlayerFunds(balance: number, amount: number): void {
    if (balance < amount) {
        throw new EconomyError('economy_insufficient_funds', 'player cannot be overdrawn');
    }
}

function createActivity(
    terminal: GameTerminalResult,
    amountIn: number,
    activityId: string,
): GameActivity {
    const common = {
        id: requireGameId(activityId),
        amountIn,
    };
    if (terminal.kind === 'dice') {
        const settlement = terminal.settlement;
        return {
            ...common,
            sourceId: settlement.gameId,
            payout: settlement.payout,
            net: settlement.payout - amountIn,
            detail: {
                kind: 'dice',
                outcome: settlement.outcome,
                challenger: settlement.challenger,
                finalBid: { ...settlement.finalBid },
                bids: settlement.bids.map((bid) => ({ ...bid })),
                playerDice: [...settlement.playerDice],
                dealerDice: [...settlement.dealerDice],
                matchingDiceCount: settlement.matchingDiceCount,
            },
        };
    }
    if (terminal.kind === 'push') {
        const settlement = terminal.settlement;
        return {
            ...common,
            sourceId: settlement.gameId,
            payout: settlement.payout,
            net: settlement.payout - amountIn,
            detail: {
                kind: 'push',
                outcome: settlement.outcome,
                revealedCoins: settlement.revealedCoins,
            },
        };
    }
    const settlement = terminal.settlement;
    return {
        ...common,
        sourceId: settlement.gameId,
        payout: settlement.payout,
        net: settlement.payout - amountIn,
        detail: {
            kind: 'ladder',
            outcome: settlement.outcome,
            steps: settlement.steps.map((step) => ({ ...step })),
        },
    };
}

export function continuedResult(game: NonNullable<GameState['activeGame']>): GameEventResult {
    return { changes: [{ kind: 'game-advanced', game }], activities: [] };
}

export function terminalAction(
    terminal: GameTerminalResult,
    amountIn: number,
    activityId: string,
): Pick<PreparedGameAction, 'result' | 'economyLegs'> {
    const activity = createActivity(terminal, amountIn, activityId);
    return {
        result: {
            changes: [{ kind: 'game-ended', gameId: terminal.settlement.gameId }],
            activities: [activity],
        },
        economyLegs: gameSettlementLegs(terminal.settlement.gameId, amountIn, terminal.settlement.payout),
    };
}
