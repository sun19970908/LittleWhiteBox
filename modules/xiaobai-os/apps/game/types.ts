export type GameClientStatus = 'ready' | 'loading' | 'saving' | 'save-failed' | 'unconfirmed' | 'conflict' | 'blocked';
export type GameKind = 'dice' | 'push' | 'ladder';
export type GameDieFace = 1 | 2 | 3 | 4 | 5 | 6;
export type GameDiceBidFace = 2 | 3 | 4 | 5 | 6;
export type GameDiceParticipant = 'player' | 'dealer';
export type GameLadderChoice = 'safe' | 'medium' | 'risky';

export interface GameDiceBidView {
    count: number;
    face: GameDiceBidFace;
    by?: GameDiceParticipant;
}

export interface GameDiceGameView {
    kind: 'dice';
    id: string;
    bet: number;
    playerDice: GameDieFace[];
    bids: Array<Required<GameDiceBidView>>;
    legalActions: Array<'bid' | 'challenge'>;
    legalBids: GameDiceBidView[];
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

export interface GameLadderStepView {
    floor: number;
    choice: GameLadderChoice;
    amountAfterSuccess: number;
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
    steps: GameLadderStepView[];
    nextChoices: GameLadderChoiceView[];
    legalActions: Array<'step' | 'cash-out'>;
}

export type GameActiveGameView = GameDiceGameView | GamePushGameView | GameLadderGameView;

export interface GameDiceRecordDetailView {
    kind: 'dice';
    challenger: GameDiceParticipant;
    finalBid: Required<GameDiceBidView>;
    bids: Array<Required<GameDiceBidView>>;
    playerDice: GameDieFace[];
    dealerDice: GameDieFace[];
    matchingDiceCount: number;
}

export interface GamePushRecordDetailView {
    kind: 'push';
    revealedCoins: number;
}

export interface GameLadderRecordStepView {
    floor: number;
    choice: GameLadderChoice;
    success: boolean;
    amountAfterStep: number;
}

export interface GameLadderRecordDetailView {
    kind: 'ladder';
    steps: GameLadderRecordStepView[];
}

export type GameRecordDetailView =
    | GameDiceRecordDetailView
    | GamePushRecordDetailView
    | GameLadderRecordDetailView;

export interface GameRecordView {
    id: string;
    gameId: string;
    game: GameKind;
    gameLabel: string;
    outcome: string;
    outcomeLabel: string;
    outcomeTone: 'win' | 'loss' | 'neutral';
    amountIn: number;
    payout: number;
    net: number;
    createdAt: number;
    detail: GameRecordDetailView;
}

export interface GameRecordPageView {
    records: GameRecordView[];
    offset: number;
    total: number;
    hasMore: boolean;
}

export interface GameClientState extends GameRecordPageView {
    chatIdentity: string;
    currency: '小白币';
    balance: number;
    lockedAmount: number;
    revision: number;
    eventId: string;
    status: GameClientStatus;
    message: string;
    generationActive: boolean;
    activeGame: GameActiveGameView | null;
}
