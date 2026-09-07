import type { GameDiceBidView, GameDiceBidFace, GameDieFace } from '../../../types.js';
const NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function diceCall(bid: Pick<GameDiceBidView, 'count' | 'face'>): string {
    return `${NUMBERS[bid.count] || bid.count}个${NUMBERS[bid.face]}`;
}
export function availableFaces(bids: GameDiceBidView[], count: number): GameDiceBidFace[] {
    return bids.filter(bid => bid.count === count).map(bid => bid.face);
}
export function diceMatch(die: GameDieFace, face: GameDiceBidFace): boolean {return die === 1 || die === face;}
