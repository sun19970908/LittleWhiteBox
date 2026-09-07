/** One brisk physical beat shared by live and showdown dice. */
export const GAME_DIE_ROLL_MS = 720;
export const GAME_DIE_STAGGER_MS = 45;

const ROLL_SETTLE_PADDING_MS = 80;
const COUNT_MS = 180;
const VERDICT_MS = 200;

export function gameDiceRevealTimeline(longestRow: number): {
    countAt: number;
    verdictAt: number;
    settledAt: number;
} {
    const lastDelay = Math.max(0, longestRow - 1) * GAME_DIE_STAGGER_MS;
    const countAt = lastDelay + GAME_DIE_ROLL_MS + ROLL_SETTLE_PADDING_MS;
    const verdictAt = countAt + COUNT_MS;
    return { countAt, verdictAt, settledAt: verdictAt + VERDICT_MS };
}
