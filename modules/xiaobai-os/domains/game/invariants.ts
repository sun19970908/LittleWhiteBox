import { countGameDiceBidMatches, isGameDiceBidHigher } from './games/dice-bluff.js';
import { validateGameHistory } from './history.js';
import {
    GAME_SCHEMA_VERSION,
    throwGameError,
    type GameAction,
    type GameActiveGame,
    type GameActivity,
    type GameActivityDetail,
    type GameChange,
    type GameDiceBid,
    type GameDiceBidValue,
    type GameDiceTuple,
    type GameDomainV1,
    type GameEvent,
    type GameEventResult,
    type GameLadderChoice,
    type GameLadderTerminalStep,
    type GamePrivateDiceGame,
    type GamePrivateLadderGame,
    type GamePrivatePushGame,
    type GameState,
} from './types.js';

const MAX_DATE_MS = 8_640_000_000_000_000;
const MAX_ID_LENGTH = 200;

function invalid(detail: string): never {
    return throwGameError('game_invalid_domain', detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactRecord(value: unknown, keys: readonly string[], detail: string): Record<string, unknown> {
    if (!isRecord(value)) {return invalid(`${detail}.shape`);}
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {return invalid(`${detail}.prototype`);}
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        return invalid(`${detail}.keys`);
    }
    return value;
}

function canonicalId(value: unknown, detail: string): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
        return invalid(detail);
    }
    return value;
}

function safeInteger(value: unknown, minimum: number, detail: string): number {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) {return invalid(detail);}
    return Number(value);
}

function gameAmount(value: unknown, minimum: number, detail: string): number {
    return safeInteger(value, minimum, detail);
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function validateDiceBidValue(value: unknown, detail: string): GameDiceBidValue {
    const bid = exactRecord(value, ['count', 'face'], detail);
    const count = safeInteger(bid.count, 1, `${detail}.count`);
    const face = safeInteger(bid.face, 2, `${detail}.face`);
    if (count > 10 || face > 6) {return invalid(detail);}
    return { count, face: face as GameDiceBidValue['face'] };
}

function validateDiceBid(value: unknown, detail: string): GameDiceBid {
    const bid = exactRecord(value, ['by', 'count', 'face'], detail);
    if (bid.by !== 'player' && bid.by !== 'dealer') {return invalid(`${detail}.by`);}
    return { by: bid.by, ...validateDiceBidValue({ count: bid.count, face: bid.face }, detail) };
}

function validateDiceTuple(value: unknown, detail: string): GameDiceTuple {
    if (!Array.isArray(value) || value.length !== 5 || value.some((face) => (
        !Number.isSafeInteger(face) || Number(face) < 1 || Number(face) > 6
    ))) {return invalid(detail);}
    return [...value] as GameDiceTuple;
}

function validateBidSequence(value: unknown, detail: string, requireWaiting: boolean): GameDiceBid[] {
    if (!Array.isArray(value) || (requireWaiting && value.length % 2 !== 0)) {return invalid(detail);}
    const bids = value.map((entry, index) => validateDiceBid(entry, `${detail}.${index}`));
    for (let index = 0; index < bids.length; index += 1) {
        const current = bids[index];
        const previous = bids[index - 1];
        if (!current || current.by !== (index % 2 === 0 ? 'player' : 'dealer')
            || (previous && !isGameDiceBidHigher(current, previous))) {return invalid(detail);}
    }
    return bids;
}

function validateDiceGame(value: unknown, detail: string): GamePrivateDiceGame {
    const game = exactRecord(value, ['id', 'bet', 'playerDice', 'dealerDice', 'bids'], detail);
    return {
        id: canonicalId(game.id, `${detail}.id`),
        bet: gameAmount(game.bet, 1, `${detail}.bet`),
        playerDice: validateDiceTuple(game.playerDice, `${detail}.playerDice`),
        dealerDice: validateDiceTuple(game.dealerDice, `${detail}.dealerDice`),
        bids: validateBidSequence(game.bids, `${detail}.bids`, true),
    };
}

function validatePushGame(value: unknown, detail: string): GamePrivatePushGame {
    const game = exactRecord(value, ['id', 'bet', 'deck', 'drawIndex', 'revealedCoins', 'cashoutAmount'], detail);
    if (!Array.isArray(game.deck) || game.deck.length === 0
        || game.deck.some((card) => card !== 'coin' && card !== 'bomb')) {return invalid(`${detail}.deck`);}
    const deck = [...game.deck];
    const drawIndex = safeInteger(game.drawIndex, 0, `${detail}.drawIndex`);
    const revealedCoins = safeInteger(game.revealedCoins, 0, `${detail}.revealedCoins`);
    if (drawIndex >= deck.length || revealedCoins !== drawIndex
        || deck.slice(0, drawIndex).some((card) => card !== 'coin')) {return invalid(detail);}
    return {
        id: canonicalId(game.id, `${detail}.id`),
        bet: gameAmount(game.bet, 1, `${detail}.bet`),
        deck,
        drawIndex,
        revealedCoins,
        cashoutAmount: gameAmount(game.cashoutAmount, 0, `${detail}.cashoutAmount`),
    };
}

function ladderChoice(value: unknown, detail: string): GameLadderChoice {
    if (value !== 'safe' && value !== 'medium' && value !== 'risky') {return invalid(detail);}
    return value;
}

function validateLadderSuccessSteps(value: unknown, detail: string): GamePrivateLadderGame['steps'] {
    if (!Array.isArray(value)) {return invalid(detail);}
    return value.map((entry, index) => {
        const step = exactRecord(entry, ['floor', 'choice', 'amountAfterSuccess'], `${detail}.${index}`);
        const floor = safeInteger(step.floor, 1, `${detail}.${index}.floor`);
        if (floor !== index + 1) {return invalid(detail);}
        return {
            floor,
            choice: ladderChoice(step.choice, `${detail}.${index}.choice`),
            amountAfterSuccess: gameAmount(step.amountAfterSuccess, 1, `${detail}.${index}.amountAfterSuccess`),
        };
    });
}

function validateLadderGame(value: unknown, detail: string): GamePrivateLadderGame {
    const game = exactRecord(value, ['id', 'bet', 'riskBase', 'steps'], detail);
    return {
        id: canonicalId(game.id, `${detail}.id`),
        bet: gameAmount(game.bet, 1, `${detail}.bet`),
        riskBase: gameAmount(game.riskBase, 1, `${detail}.riskBase`),
        steps: validateLadderSuccessSteps(game.steps, `${detail}.steps`),
    };
}

function validateActiveGame(value: unknown, detail: string): GameActiveGame {
    const active = exactRecord(value, ['kind', 'game'], detail);
    if (active.kind === 'dice') {return { kind: 'dice', game: validateDiceGame(active.game, `${detail}.game`) };}
    if (active.kind === 'push') {return { kind: 'push', game: validatePushGame(active.game, `${detail}.game`) };}
    if (active.kind === 'ladder') {return { kind: 'ladder', game: validateLadderGame(active.game, `${detail}.game`) };}
    return invalid(`${detail}.kind`);
}

/** Parses the persisted V1 command shape. Current product policy is enforced before append. */
export function validateGameAction(value: unknown): GameAction {
    const source = isRecord(value) ? value : {};
    const kind = source.kind;
    const keys: Record<GameAction['kind'], readonly string[]> = {
        'dice-start': ['kind', 'gameId', 'bet'],
        'dice-bid': ['kind', 'gameId', 'bid'],
        'dice-challenge': ['kind', 'gameId'],
        'push-start': ['kind', 'gameId'],
        'push-draw': ['kind', 'gameId'],
        'push-cash-out': ['kind', 'gameId'],
        'ladder-start': ['kind', 'gameId', 'bet'],
        'ladder-step': ['kind', 'gameId', 'choice'],
        'ladder-cash-out': ['kind', 'gameId'],
    };
    if (typeof kind !== 'string' || !(kind in keys)) {return invalid('command.kind');}
    const commandKind = kind as GameAction['kind'];
    const command = exactRecord(value, keys[commandKind], 'command');
    const gameId = canonicalId(command.gameId, 'command.gameId');
    if (commandKind === 'dice-start' || commandKind === 'ladder-start') {
        return { kind: commandKind, gameId, bet: gameAmount(command.bet, 1, 'command.bet') };
    }
    if (commandKind === 'dice-bid') {
        return { kind: commandKind, gameId, bid: validateDiceBidValue(command.bid, 'command.bid') };
    }
    if (commandKind === 'ladder-step') {
        return { kind: commandKind, gameId, choice: ladderChoice(command.choice, 'command.choice') };
    }
    if (commandKind === 'dice-challenge') {return { kind: commandKind, gameId };}
    if (commandKind === 'push-start') {return { kind: commandKind, gameId };}
    if (commandKind === 'push-draw') {return { kind: commandKind, gameId };}
    if (commandKind === 'push-cash-out') {return { kind: commandKind, gameId };}
    return { kind: 'ladder-cash-out', gameId };
}

function validateLadderTerminalSteps(value: unknown, detail: string): GameLadderTerminalStep[] {
    if (!Array.isArray(value)) {return invalid(detail);}
    return value.map((entry, index) => {
        const step = exactRecord(entry, ['floor', 'choice', 'success', 'amountAfterStep'], `${detail}.${index}`);
        if (typeof step.success !== 'boolean') {return invalid(`${detail}.${index}.success`);}
        const floor = safeInteger(step.floor, 1, `${detail}.${index}.floor`);
        if (floor !== index + 1) {return invalid(detail);}
        return {
            floor,
            choice: ladderChoice(step.choice, `${detail}.${index}.choice`),
            success: step.success,
            amountAfterStep: gameAmount(step.amountAfterStep, 0, `${detail}.${index}.amountAfterStep`),
        };
    });
}

function validateActivityDetail(value: unknown): GameActivityDetail {
    const source = isRecord(value) ? value : {};
    if (source.kind === 'dice') {
        const detail = exactRecord(value, [
            'kind', 'outcome', 'challenger', 'finalBid', 'bids', 'playerDice', 'dealerDice', 'matchingDiceCount',
        ], 'activity.detail');
        if (detail.outcome !== 'player-win' && detail.outcome !== 'dealer-win') {return invalid('activity.detail.outcome');}
        if (detail.challenger !== 'player' && detail.challenger !== 'dealer') {return invalid('activity.detail.challenger');}
        const bids = validateBidSequence(detail.bids, 'activity.detail.bids', false);
        const finalBid = validateDiceBid(detail.finalBid, 'activity.detail.finalBid');
        const playerDice = validateDiceTuple(detail.playerDice, 'activity.detail.playerDice');
        const dealerDice = validateDiceTuple(detail.dealerDice, 'activity.detail.dealerDice');
        const matchingDiceCount = safeInteger(detail.matchingDiceCount, 0, 'activity.detail.matchingDiceCount');
        if (matchingDiceCount > 10 || bids.length === 0 || !sameJson(finalBid, bids.at(-1))
            || finalBid.by === detail.challenger
            || matchingDiceCount !== countGameDiceBidMatches({ playerDice, dealerDice }, finalBid)) {
            return invalid('activity.detail.dice');
        }
        const bidHolds = matchingDiceCount >= finalBid.count;
        const playerWins = bidHolds ? finalBid.by === 'player' : detail.challenger === 'player';
        if ((detail.outcome === 'player-win') !== playerWins) {return invalid('activity.detail.dice-result');}
        return {
            kind: 'dice', outcome: detail.outcome, challenger: detail.challenger,
            finalBid, bids, playerDice, dealerDice, matchingDiceCount,
        };
    }
    if (source.kind === 'push') {
        const detail = exactRecord(value, ['kind', 'outcome', 'revealedCoins'], 'activity.detail');
        if (detail.outcome !== 'busted' && detail.outcome !== 'cleared' && detail.outcome !== 'cashed-out') {
            return invalid('activity.detail.outcome');
        }
        return {
            kind: 'push',
            outcome: detail.outcome,
            revealedCoins: safeInteger(detail.revealedCoins, 0, 'activity.detail.revealedCoins'),
        };
    }
    if (source.kind === 'ladder') {
        const detail = exactRecord(value, ['kind', 'outcome', 'steps'], 'activity.detail');
        if (detail.outcome !== 'cashed-out' && detail.outcome !== 'failed'
            && detail.outcome !== 'cleared' && detail.outcome !== 'capped') {
            return invalid('activity.detail.outcome');
        }
        return {
            kind: 'ladder',
            outcome: detail.outcome,
            steps: validateLadderTerminalSteps(detail.steps, 'activity.detail.steps'),
        };
    }
    return invalid('activity.detail.kind');
}

function validateActivity(value: unknown, detail: string): GameActivity {
    const activity = exactRecord(value, ['id', 'sourceId', 'detail', 'amountIn', 'payout', 'net'], detail);
    const amountIn = gameAmount(activity.amountIn, 1, `${detail}.amountIn`);
    const paid = gameAmount(activity.payout, 0, `${detail}.payout`);
    if (!Number.isSafeInteger(activity.net) || activity.net !== paid - amountIn) {return invalid(`${detail}.net`);}
    return {
        id: canonicalId(activity.id, `${detail}.id`),
        sourceId: canonicalId(activity.sourceId, `${detail}.sourceId`),
        detail: validateActivityDetail(activity.detail),
        amountIn,
        payout: paid,
        net: Number(activity.net),
    };
}

function validateChange(value: unknown, detail: string): GameChange {
    const source = isRecord(value) ? value : {};
    if (source.kind === 'game-started' || source.kind === 'game-advanced') {
        const change = exactRecord(value, ['kind', 'game'], detail);
        return { kind: source.kind, game: validateActiveGame(change.game, `${detail}.game`) };
    }
    if (source.kind === 'game-ended') {
        const change = exactRecord(value, ['kind', 'gameId'], detail);
        return { kind: 'game-ended', gameId: canonicalId(change.gameId, `${detail}.gameId`) };
    }
    return invalid(`${detail}.kind`);
}

export function validateGameEventResult(value: unknown): GameEventResult {
    const result = exactRecord(value, ['changes', 'activities'], 'result');
    if (!Array.isArray(result.changes) || !Array.isArray(result.activities)) {return invalid('result.arrays');}
    return {
        changes: result.changes.map((change, index) => validateChange(change, `result.changes.${index}`)),
        activities: result.activities.map((activity, index) => validateActivity(activity, `result.activities.${index}`)),
    };
}

function validateEvent(value: unknown, expectedRevision: number): GameEvent {
    const event = exactRecord(value, ['revision', 'eventId', 'actionId', 'command', 'result', 'createdAt'], 'event');
    if (event.revision !== expectedRevision) {return invalid('event.revision');}
    const createdAt = safeInteger(event.createdAt, 0, 'event.createdAt');
    return {
        revision: expectedRevision,
        eventId: canonicalId(event.eventId, 'event.eventId'),
        actionId: canonicalId(event.actionId, 'event.actionId'),
        command: validateGameAction(event.command),
        result: validateGameEventResult(event.result),
        createdAt: createdAt <= MAX_DATE_MS ? createdAt : invalid('event.createdAt'),
    };
}

export function validateGameState(value: unknown): asserts value is GameState {
    const source = isRecord(value) ? value : {};
    const state = exactRecord(value, source.activeGame === undefined ? [] : ['activeGame'], 'state');
    if (state.activeGame !== undefined) {validateActiveGame(state.activeGame, 'state.activeGame');}
}

/** Accepts V1's exact serialized shape, then validates only frozen historical semantics. */
export function validateGameDomain(value: unknown): asserts value is GameDomainV1 {
    if (!isRecord(value)) {invalid('domain.shape');}
    if (value.schemaVersion !== GAME_SCHEMA_VERSION) {throwGameError('game_unsupported_version');}
    const domain = exactRecord(value, ['schemaVersion', 'events'], 'domain');
    if (!Array.isArray(domain.events)) {invalid('domain.events');}
    const eventIds = new Set<string>();
    const actionIds = new Set<string>();
    const events = domain.events.map((entry, index) => {
        const event = validateEvent(entry, index + 1);
        if (eventIds.has(event.eventId) || actionIds.has(event.actionId)) {invalid('event.id-duplicate');}
        eventIds.add(event.eventId);
        actionIds.add(event.actionId);
        return event;
    });
    validateGameHistory(events);
}
