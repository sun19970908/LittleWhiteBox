import type { GameActiveGameView, GameClientState, GameKind, GameRecordView } from '../types.js';

export interface GameAction {
    endpoint: `game/${GameKind}/${string}`;
    payload?: Record<string, unknown>;
}
export interface GameSettlement {
    before: GameActiveGameView;
    record: GameRecordView;
    balanceAfter: number;
}
export interface GameRoomProps {
    state: GameClientState;
    disabledReason: string;
    inFlight: GameAction | null;
    settlement: GameSettlement | null;
}
