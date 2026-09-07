import type { GameKind } from './types.js';

/** Player-facing identity shared by the host's records and the game's UI. */
export const GAME_CATALOG = [
    { id: 'dice', name: '大话骰', category: '斗智', tagline: '摇一摇，猜猜他敢叫几个', description: '你一口，我一口。不信？开盅见分晓。', entry: '50 小白币起', mark: '骰', tone: 'jade' },
    { id: 'push', name: '翻牌寻金', category: '手气', tagline: '再翻一张，还是见好就收', description: '金币已经到手，下一张会是什么？', entry: '每局 50 小白币', mark: '金', tone: 'claret' },
    { id: 'ladder', name: '步步登高', category: '闯关', tagline: '走稳一点，还是大胆一搏', description: '五层阶梯，选你的路，也选收手的时机。', entry: '30 小白币起', mark: '阶', tone: 'amber' },
] as const satisfies ReadonlyArray<{ id: GameKind; name: string; category: string; tagline: string; description: string; entry: string; mark: string; tone: string }>;

export function gameInfo(kind: GameKind) {
    return GAME_CATALOG.find(game => game.id === kind)!;
}
