export const GAME_SCHEMA_VERSION = 1 as const;

export type GameDieFace = 1 | 2 | 3 | 4 | 5 | 6;
export type GameDiceBidFace = 2 | 3 | 4 | 5 | 6;
export type GameDiceParticipant = 'player' | 'dealer';
export type GameDiceTuple = [GameDieFace, GameDieFace, GameDieFace, GameDieFace, GameDieFace];

export interface GameDiceBidValue {
    count: number;
    face: GameDiceBidFace;
}

export interface GameDiceBid extends GameDiceBidValue {
    by: GameDiceParticipant;
}

export interface GamePrivateDiceGame {
    id: string;
    bet: number;
    playerDice: GameDiceTuple;
    dealerDice: GameDiceTuple;
    bids: GameDiceBid[];
}

export type GamePushCard = 'coin' | 'bomb';

export interface GamePrivatePushGame {
    id: string;
    bet: number;
    deck: GamePushCard[];
    drawIndex: number;
    revealedCoins: number;
    cashoutAmount: number;
}

export type GameLadderChoice = 'safe' | 'medium' | 'risky';

export interface GameLadderSuccessStep {
    floor: number;
    choice: GameLadderChoice;
    amountAfterSuccess: number;
}

export interface GameLadderTerminalStep {
    floor: number;
    choice: GameLadderChoice;
    success: boolean;
    amountAfterStep: number;
}

export interface GamePrivateLadderGame {
    id: string;
    bet: number;
    riskBase: number;
    steps: GameLadderSuccessStep[];
}

export type GameActiveGame =
    | { kind: 'dice'; game: GamePrivateDiceGame }
    | { kind: 'push'; game: GamePrivatePushGame }
    | { kind: 'ladder'; game: GamePrivateLadderGame };

export type GameDiceAction =
    | { kind: 'bid'; bid: GameDiceBidValue }
    | { kind: 'challenge' };

export type GamePushAction =
    | { kind: 'draw' }
    | { kind: 'cash-out' };

export type GameLadderAction =
    | { kind: 'step'; choice: GameLadderChoice }
    | { kind: 'cash-out' };

export interface GameDiceSettlement {
    gameId: string;
    outcome: 'player-win' | 'dealer-win';
    challenger: GameDiceParticipant;
    finalBid: GameDiceBid;
    bids: GameDiceBid[];
    playerDice: GameDiceTuple;
    dealerDice: GameDiceTuple;
    matchingDiceCount: number;
    payout: number;
}

export interface GamePushSettlement {
    gameId: string;
    outcome: 'cashed-out' | 'busted' | 'cleared';
    payout: number;
    revealedCoins: number;
}

export interface GameLadderSettlement {
    gameId: string;
    outcome: 'cashed-out' | 'failed' | 'cleared' | 'capped';
    payout: number;
    steps: GameLadderTerminalStep[];
}

export type GameTerminalResult =
    | { kind: 'dice'; settlement: GameDiceSettlement }
    | { kind: 'push'; settlement: GamePushSettlement }
    | { kind: 'ladder'; settlement: GameLadderSettlement };

export type GameDiceTransition =
    | { kind: 'continued'; game: GamePrivateDiceGame; dealerBid: GameDiceBid }
    | { kind: 'settled'; settlement: GameDiceSettlement };

export type GamePushTransition =
    | { kind: 'continued'; game: GamePrivatePushGame }
    | { kind: 'settled'; settlement: GamePushSettlement };

export type GameLadderTransition =
    | { kind: 'continued'; game: GamePrivateLadderGame; step: GameLadderSuccessStep }
    | { kind: 'settled'; settlement: GameLadderSettlement };

export interface GameDiceGameView {
    kind: 'dice';
    id: string;
    bet: number;
    playerDice: GameDiceTuple;
    bids: GameDiceBid[];
    legalActions: Array<'bid' | 'challenge'>;
    legalBids: GameDiceBidValue[];
}

export interface GamePushGameView {
    kind: 'push';
    id: string;
    bet: number;
    revealedCoins: number;
    cashoutAmount: number;
    remainingCards: number;
    remainingBombs: number;
    nextBombProbabilityBps: number;
    legalActions: Array<'draw' | 'cash-out'>;
}

export interface GameLadderChoiceView {
    choice: GameLadderChoice;
    successProbabilityBps: number;
    successAmount: number;
}

export interface GameLadderGameView {
    kind: 'ladder';
    id: string;
    bet: number;
    riskBase: number;
    completedFloors: number;
    cashoutAmount: number;
    canCashOut: boolean;
    steps: GameLadderSuccessStep[];
    nextChoices: GameLadderChoiceView[];
    legalActions: Array<'step' | 'cash-out'>;
}

export type GamePublicGameView = GameDiceGameView | GamePushGameView | GameLadderGameView;

export interface GameState {
    activeGame?: GameActiveGame;
}

export interface GameDiceActivityDetail {
    kind: 'dice';
    outcome: GameDiceSettlement['outcome'];
    challenger: GameDiceParticipant;
    finalBid: GameDiceBid;
    bids: GameDiceBid[];
    playerDice: GameDiceTuple;
    dealerDice: GameDiceTuple;
    matchingDiceCount: number;
}

export interface GamePushActivityDetail {
    kind: 'push';
    outcome: GamePushSettlement['outcome'];
    revealedCoins: number;
}

export interface GameLadderActivityDetail {
    kind: 'ladder';
    outcome: GameLadderSettlement['outcome'];
    steps: GameLadderTerminalStep[];
}

export type GameActivityDetail =
    | GameDiceActivityDetail
    | GamePushActivityDetail
    | GameLadderActivityDetail;

export interface GameActivity {
    id: string;
    sourceId: string;
    detail: GameActivityDetail;
    amountIn: number;
    payout: number;
    net: number;
}

export interface GameActivityRecord extends GameActivity {
    revision: number;
    eventId: string;
    actionId: string;
    createdAt: number;
}

export type GameAction =
    | { kind: 'dice-start'; gameId: string; bet: number }
    | { kind: 'dice-bid'; gameId: string; bid: GameDiceBidValue }
    | { kind: 'dice-challenge'; gameId: string }
    | { kind: 'push-start'; gameId: string }
    | { kind: 'push-draw'; gameId: string }
    | { kind: 'push-cash-out'; gameId: string }
    | { kind: 'ladder-start'; gameId: string; bet: number }
    | { kind: 'ladder-step'; gameId: string; choice: GameLadderChoice }
    | { kind: 'ladder-cash-out'; gameId: string };

export type GameChange =
    | { kind: 'game-started'; game: GameActiveGame }
    | { kind: 'game-advanced'; game: GameActiveGame }
    | { kind: 'game-ended'; gameId: string };

export interface GameEventResult {
    changes: GameChange[];
    activities: GameActivity[];
}

export interface GameEvent {
    revision: number;
    eventId: string;
    actionId: string;
    command: GameAction;
    result: GameEventResult;
    createdAt: number;
}

export interface GameDomainV1 {
    schemaVersion: typeof GAME_SCHEMA_VERSION;
    events: GameEvent[];
}

export interface GameCasToken {
    expectedRevision: number;
    expectedEventId: string;
}

export interface GameAppendEventInput extends GameCasToken {
    eventId: string;
    actionId: string;
    command: GameAction;
    result: GameEventResult;
    createdAt: number;
}

export interface GameCommandResult {
    domain: GameDomainV1;
    event: GameEvent;
    state: GameState;
    created: boolean;
}

export interface GamePublicActivityRecord {
    id: string;
    sourceId: string;
    detail: GameActivityDetail;
    amountIn: number;
    payout: number;
    net: number;
    revision: number;
    eventId: string;
    actionId: string;
    createdAt: number;
}

export interface GameActivityPage {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface GameClientView {
    revision: number;
    eventId: string;
    lockedAmount: number;
    activeGame?: GamePublicGameView;
    activities: GamePublicActivityRecord[];
    activityPage: GameActivityPage;
}

export interface GameRandomSource {
    nextInt(maxExclusive: number): number;
}

export type GameErrorCode =
    | 'game_action_required'
    | 'game_action_conflict'
    | 'game_revision_conflict'
    | 'game_event_id_conflict'
    | 'game_invalid_context'
    | 'game_invalid_domain'
    | 'game_unsupported_version'
    | 'game_amount_invalid'
    | 'game_amount_out_of_range'
    | 'game_amount_overflow'
    | 'game_random_invalid'
    | 'game_random_exhausted'
    | 'game_id_required'
    | 'game_invalid'
    | 'game_action_invalid'
    | 'game_dice_bid_invalid'
    | 'game_dice_bid_not_higher'
    | 'game_dice_challenge_invalid'
    | 'game_push_cashout_invalid'
    | 'game_ladder_cashout_invalid'
    | 'game_ladder_choice_invalid';

export class GameError extends Error {
    readonly code: GameErrorCode;

    constructor(code: GameErrorCode, detail = '') {
        super(detail ? `${code}:${detail}` : code);
        this.name = 'GameError';
        this.code = code;
    }
}

export function throwGameError(code: GameErrorCode, detail = ''): never {
    throw new GameError(code, detail);
}
