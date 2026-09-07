import { assertPositiveGameAmount, multiplyGameAmount } from '../money.js';
import { nextGameRandomInt, rollGameDie } from '../random.js';
import {
    throwGameError,
    type GameDiceAction,
    type GameDiceBid,
    type GameDiceBidFace,
    type GameDiceBidValue,
    type GameDiceGameView,
    type GameDiceParticipant,
    type GameDiceSettlement,
    type GameDiceTransition,
    type GameDiceTuple,
    type GameDieFace,
    type GamePrivateDiceGame,
    type GameRandomSource,
} from '../types.js';

export const GAME_DICE_MIN_BET = 50 as const;
export const GAME_DICE_MAX_BET = 500 as const;
export const GAME_DICE_BET_STEP = 10 as const;
/**
 * Dice is a symmetric duel, so equilibrium sits near a 50% win rate and the
 * payout multiplier is the only real house edge. At 1.9x that edge is 5%, which
 * a heuristic dealer cannot defend against a best-responding player; 1.8x puts
 * the worst observed case at ~96% RTP, in line with push and ladder.
 */
export const GAME_DICE_PAYOUT_NUMERATOR = 18 as const;
export const GAME_DICE_PAYOUT_DENOMINATOR = 10 as const;
/**
 * How much of an opponent's announced count is credited to their own hand.
 * A bidder holding `h` of a face expects the other five dice to add ~5/3, so
 * they announce roughly `h + 2`; reading the count back through this offset is
 * what keeps the dealer from mistaking "I hold none" for "that cannot hold".
 */
export const GAME_DICE_INFORMED_BID_OFFSET = 2 as const;
/** Gap required before the dealer commits instead of leaving it to chance. */
export const GAME_DICE_DEALER_DECISION_MARGIN = 0.1 as const;

export interface CreateGameDiceGameInput {
    id: string;
    bet: number;
}

export type GameDiceDealerResponsePolicy =
    | { kind: 'challenge' }
    | { kind: 'raise' | 'random'; dealerBid: GameDiceBidValue };

export interface GameDiceDealerRaise {
    bid: GameDiceBidValue;
    confidence: number;
}

function assertGameId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {throwGameError('game_id_required');}
    return value.trim();
}

export function normalizeGameDiceBet(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)
        || value < GAME_DICE_MIN_BET || value > GAME_DICE_MAX_BET
        || value % GAME_DICE_BET_STEP !== 0) {
        throwGameError('game_amount_out_of_range', 'dice-bet');
    }
    return value;
}

export function normalizeGameDiceBid(value: unknown, by: GameDiceParticipant): GameDiceBid {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throwGameError('game_dice_bid_invalid');
    }
    const raw = value as Record<string, unknown>;
    if (typeof raw.count !== 'number' || !Number.isSafeInteger(raw.count)
        || raw.count < 1 || raw.count > 10
        || typeof raw.face !== 'number' || !Number.isSafeInteger(raw.face)
        || raw.face < 2 || raw.face > 6) {
        throwGameError('game_dice_bid_invalid');
    }
    return { by, count: raw.count, face: raw.face as GameDiceBidFace };
}

export function isGameDiceBidHigher(next: GameDiceBidValue, current: GameDiceBidValue): boolean {
    return next.count > current.count || (next.count === current.count && next.face > current.face);
}

export function listGameLegalDiceBids(current?: GameDiceBidValue): GameDiceBidValue[] {
    const bids: GameDiceBidValue[] = [];
    for (let count = 1; count <= 10; count += 1) {
        for (let face = 2; face <= 6; face += 1) {
            const bid: GameDiceBidValue = { count, face: face as GameDiceBidFace };
            if (!current || isGameDiceBidHigher(bid, current)) {bids.push(bid);}
        }
    }
    return bids;
}

export function countGameDiceMatches(dice: readonly GameDieFace[], face: GameDiceBidFace): number {
    return dice.filter((die) => die === 1 || die === face).length;
}

export function countGameDiceBidMatches(
    game: Pick<GamePrivateDiceGame, 'playerDice' | 'dealerDice'>,
    bid: Pick<GameDiceBid, 'face'>,
): number {
    return countGameDiceMatches(game.playerDice, bid.face)
        + countGameDiceMatches(game.dealerDice, bid.face);
}

function binomialCoefficient(n: number, k: number): number {
    const selected = Math.min(k, n - k);
    let result = 1;
    for (let index = 1; index <= selected; index += 1) {
        result = (result * (n - selected + index)) / index;
    }
    return result;
}

export function gameBinomialAtLeastProbability(
    trials: number,
    hitProbability: number,
    minimumHits: number,
): number {
    if (!Number.isSafeInteger(trials) || trials < 0
        || !Number.isFinite(hitProbability) || hitProbability < 0 || hitProbability > 1
        || !Number.isSafeInteger(minimumHits)) {
        throwGameError('game_invalid', 'binomial');
    }
    if (minimumHits <= 0) {return 1;}
    if (minimumHits > trials) {return 0;}
    let probability = 0;
    for (let hits = minimumHits; hits <= trials; hits += 1) {
        probability += binomialCoefficient(trials, hits)
            * (hitProbability ** hits)
            * ((1 - hitProbability) ** (trials - hits));
    }
    return probability;
}

function assertDiceTuple(value: readonly GameDieFace[], detail: string): void {
    if (!Array.isArray(value) || value.length !== 5
        || value.some((die) => !Number.isSafeInteger(die) || die < 1 || die > 6)) {
        throwGameError('game_invalid', detail);
    }
}

export function assertGameDiceGameWaitingForPlayer(game: GamePrivateDiceGame): void {
    if (!game || typeof game !== 'object') {throwGameError('game_invalid', 'dice-game');}
    assertGameId(game.id);
    assertPositiveGameAmount(game.bet, 'dice-bet');
    assertDiceTuple(game.playerDice, 'player-dice');
    assertDiceTuple(game.dealerDice, 'dealer-dice');
    if (!Array.isArray(game.bids) || game.bids.length % 2 !== 0) {
        throwGameError('game_invalid', 'dice-turn');
    }
    let previous: GameDiceBid | undefined;
    for (let index = 0; index < game.bids.length; index += 1) {
        const expected = index % 2 === 0 ? 'player' : 'dealer';
        const bid = game.bids[index];
        if (!bid || bid.by !== expected) {throwGameError('game_invalid', 'dice-bid-order');}
        const normalized = normalizeGameDiceBid(bid, expected);
        if (previous && !isGameDiceBidHigher(normalized, previous)) {
            throwGameError('game_invalid', 'dice-bid-order');
        }
        previous = normalized;
    }
}

export function getGameDiceBidProbabilityForDealer(
    dealerDice: GameDiceTuple,
    bid: GameDiceBidValue,
): number {
    assertDiceTuple(dealerDice, 'dealer-dice');
    const normalized = normalizeGameDiceBid(bid, 'player');
    const knownMatches = countGameDiceMatches(dealerDice, normalized.face);
    return gameBinomialAtLeastProbability(5, 1 / 3, normalized.count - knownMatches);
}

/**
 * Probability that a bid announced BY THE OPPONENT holds.
 *
 * Unlike {@link getGameDiceBidProbabilityForDealer}, this must not treat the
 * opponent's hand as uniformly random: they chose the bid while looking at it.
 * Crediting part of the announced count to their own hand is what stops the
 * dealer from reading "I hold none of that face" as "that bid cannot hold" and
 * challenging bids the opponent is guaranteed to make.
 */
export function getGameDiceOpponentBidCredibility(
    dice: GameDiceTuple,
    bid: GameDiceBidValue,
): number {
    assertDiceTuple(dice, 'opponent-credibility-dice');
    const normalized = normalizeGameDiceBid(bid, 'player');
    const knownMatches = countGameDiceMatches(dice, normalized.face);
    const assumedSelfHeld = Math.max(0, Math.min(5, normalized.count - GAME_DICE_INFORMED_BID_OFFSET));
    return gameBinomialAtLeastProbability(
        5 - assumedSelfHeld,
        1 / 3,
        normalized.count - knownMatches - assumedSelfHeld,
    );
}

/**
 * Picks the raise the dealer is most likely to hold, breaking ties toward the
 * smallest legal raise, and reports that confidence so the caller can weigh
 * raising against challenging. Because the ranking depends on the hidden dealer
 * dice, the player cannot predict the dealer's face without seeing that hand.
 */
export function selectGameDiceDealerRaise(
    dealerDice: GameDiceTuple,
    rawBid: GameDiceBidValue,
): GameDiceDealerRaise | undefined {
    const playerBid = normalizeGameDiceBid(rawBid, 'player');
    let selected: GameDiceDealerRaise | undefined;
    for (const candidate of listGameLegalDiceBids(playerBid)) {
        const confidence = getGameDiceBidProbabilityForDealer(dealerDice, candidate);
        if (!selected || confidence > selected.confidence) {
            selected = { bid: candidate, confidence };
        }
    }
    return selected;
}

/**
 * The dealer weighs challenging against the raise it would otherwise have to
 * make. Judging the player's bid alone is not enough: a dealer that only asks
 * "is their bid credible?" keeps calling all the way up the ladder and gets
 * executed once the count outruns what either hand can cover.
 */
export function getGameDiceDealerResponsePolicy(
    dealerDice: GameDiceTuple,
    rawBid: GameDiceBidValue,
): GameDiceDealerResponsePolicy {
    const playerBid = normalizeGameDiceBid(rawBid, 'player');
    const raise = selectGameDiceDealerRaise(dealerDice, playerBid);
    if (!raise) {return { kind: 'challenge' };}
    const challengeValue = 1 - getGameDiceOpponentBidCredibility(dealerDice, playerBid);
    if (challengeValue > raise.confidence + GAME_DICE_DEALER_DECISION_MARGIN) {
        return { kind: 'challenge' };
    }
    return {
        kind: raise.confidence > challengeValue + GAME_DICE_DEALER_DECISION_MARGIN ? 'raise' : 'random',
        dealerBid: raise.bid,
    };
}

export function createGameDiceGame(
    input: CreateGameDiceGameInput,
    random: GameRandomSource,
): GamePrivateDiceGame {
    const id = assertGameId(input.id);
    const bet = normalizeGameDiceBet(input.bet);
    const playerDice = Array.from({ length: 5 }, () => rollGameDie(random)) as GameDiceTuple;
    const dealerDice = Array.from({ length: 5 }, () => rollGameDie(random)) as GameDiceTuple;
    return { id, bet, playerDice, dealerDice, bids: [] };
}

function copyDiceGame(game: GamePrivateDiceGame, bids: GameDiceBid[]): GamePrivateDiceGame {
    return {
        id: game.id,
        bet: game.bet,
        playerDice: [...game.playerDice] as GameDiceTuple,
        dealerDice: [...game.dealerDice] as GameDiceTuple,
        bids: bids.map((bid) => ({ ...bid })),
    };
}

function createDiceSettlement(
    game: GamePrivateDiceGame,
    challenger: GameDiceParticipant,
): GameDiceSettlement {
    const finalBid = game.bids.at(-1);
    if (!finalBid || finalBid.by === challenger) {throwGameError('game_dice_challenge_invalid');}
    const matchingDiceCount = countGameDiceBidMatches(game, finalBid);
    const bidHolds = matchingDiceCount >= finalBid.count;
    const winner = bidHolds ? finalBid.by : challenger;
    return {
        gameId: game.id,
        outcome: winner === 'player' ? 'player-win' : 'dealer-win',
        challenger,
        finalBid: { ...finalBid },
        bids: game.bids.map((bid) => ({ ...bid })),
        playerDice: [...game.playerDice] as GameDiceTuple,
        dealerDice: [...game.dealerDice] as GameDiceTuple,
        matchingDiceCount,
        payout: winner === 'player'
            ? multiplyGameAmount(game.bet, GAME_DICE_PAYOUT_NUMERATOR, GAME_DICE_PAYOUT_DENOMINATOR)
            : 0,
    };
}

export function challengeGameDiceGame(game: GamePrivateDiceGame): GameDiceSettlement {
    assertGameDiceGameWaitingForPlayer(game);
    return createDiceSettlement(game, 'player');
}

/** Applies the player's bid and complete dealer response in one transition. */
export function respondToGameDicePlayerBid(
    game: GamePrivateDiceGame,
    rawBid: GameDiceBidValue,
    random: GameRandomSource,
): GameDiceTransition {
    assertGameDiceGameWaitingForPlayer(game);
    const playerBid = normalizeGameDiceBid(rawBid, 'player');
    const previousBid = game.bids.at(-1);
    if (previousBid && !isGameDiceBidHigher(playerBid, previousBid)) {
        throwGameError('game_dice_bid_not_higher');
    }
    const afterPlayerBid = copyDiceGame(game, [...game.bids, playerBid]);
    const policy = getGameDiceDealerResponsePolicy(afterPlayerBid.dealerDice, playerBid);
    if (policy.kind === 'challenge') {
        return { kind: 'settled', settlement: createDiceSettlement(afterPlayerBid, 'dealer') };
    }
    const shouldRaise = policy.kind === 'raise' || nextGameRandomInt(random, 2) === 1;
    if (!shouldRaise) {
        return { kind: 'settled', settlement: createDiceSettlement(afterPlayerBid, 'dealer') };
    }
    const dealerBid: GameDiceBid = { ...policy.dealerBid, by: 'dealer' };
    return {
        kind: 'continued',
        game: copyDiceGame(afterPlayerBid, [...afterPlayerBid.bids, dealerBid]),
        dealerBid: { ...dealerBid },
    };
}

export function advanceGameDiceGame(
    game: GamePrivateDiceGame,
    action: GameDiceAction,
    random: GameRandomSource,
): GameDiceTransition {
    if (!action || typeof action !== 'object') {throwGameError('game_action_invalid', 'dice-action');}
    if (action.kind === 'bid') {return respondToGameDicePlayerBid(game, action.bid, random);}
    if (action.kind === 'challenge') {
        return { kind: 'settled', settlement: challengeGameDiceGame(game) };
    }
    throwGameError('game_action_invalid', 'dice-action');
}

export function createGameDiceGameView(game: GamePrivateDiceGame): GameDiceGameView {
    assertGameDiceGameWaitingForPlayer(game);
    const current = game.bids.at(-1);
    const legalBids = listGameLegalDiceBids(current).map((bid) => ({ ...bid }));
    return {
        kind: 'dice',
        id: game.id,
        bet: game.bet,
        playerDice: [...game.playerDice] as GameDiceTuple,
        bids: game.bids.map((bid) => ({ ...bid })),
        legalActions: current ? (legalBids.length > 0 ? ['bid', 'challenge'] : ['challenge']) : ['bid'],
        legalBids,
    };
}
