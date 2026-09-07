import { type Component } from 'vue';
import DiceRecord from './rooms/dice/DiceRecord.vue';
import PushRecord from './rooms/push/PushRecord.vue';
import LadderRecord from './rooms/ladder/LadderRecord.vue';
import { gameInfo } from '../catalog.js';
import type { GameKind } from '../types.js';

export const GAME_ROOMS = [
    { ...gameInfo('dice'), record: DiceRecord, artwork: new URL('./rooms/dice/art.svg', import.meta.url).href, load: () => import('./rooms/dice/DiceRoom.vue') },
    { ...gameInfo('push'), record: PushRecord, artwork: new URL('./rooms/push/art.svg', import.meta.url).href, load: () => import('./rooms/push/PushRoom.vue') },
    { ...gameInfo('ladder'), record: LadderRecord, artwork: new URL('./rooms/ladder/art.svg', import.meta.url).href, load: () => import('./rooms/ladder/LadderRoom.vue') },
] satisfies Array<ReturnType<typeof gameInfo> & { record: Component; artwork: string; load: () => Promise<{ default: Component }> }>;

export function gameRoom(kind: GameKind) {return GAME_ROOMS.find(room => room.id === kind)!;}
