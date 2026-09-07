import { createGameDiceGameView } from './games/dice-bluff.js';
import { createGamePushGameView } from './games/push-your-luck.js';
import { createGameLadderGameView } from './games/risk-ladder.js';
import { validateGameDomain } from './invariants.js';
import {
    calculateGameLockedAmount,
    createEmptyGameDomain,
    flattenGameActivities,
    replayGameEvents,
} from './timeline.js';
import {
    throwGameError,
    type GameClientView,
    type GameDomainV1,
    type GamePublicActivityRecord,
    type GamePublicGameView,
} from './types.js';

export const GAME_DEFAULT_ACTIVITY_PAGE_SIZE = 50 as const;
export const GAME_MAX_ACTIVITY_PAGE_SIZE = 100 as const;

export interface CreateGameViewInput {
    domain?: GameDomainV1 | null;
    activityOffset?: number;
    activityLimit?: number;
}

function pageInteger(value: unknown, fallback: number, minimum: number, maximum: number, detail: string): number {
    if (value === undefined) {return fallback;}
    if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throwGameError('game_invalid_context', detail);
    }
    return Number(value);
}

function projectActiveGame(state: ReturnType<typeof replayGameEvents>): GamePublicGameView | undefined {
    if (!state.activeGame) {return undefined;}
    if (state.activeGame.kind === 'dice') {return createGameDiceGameView(state.activeGame.game);}
    if (state.activeGame.kind === 'push') {return createGamePushGameView(state.activeGame.game);}
    return createGameLadderGameView(state.activeGame.game);
}

function publicActivity(record: ReturnType<typeof flattenGameActivities>[number]): GamePublicActivityRecord {
    return {
        id: record.id,
        sourceId: record.sourceId,
        detail: structuredClone(record.detail),
        amountIn: record.amountIn,
        payout: record.payout,
        net: record.net,
        revision: record.revision,
        eventId: record.eventId,
        actionId: record.actionId,
        createdAt: record.createdAt,
    };
}

/** Constructs a fresh public snapshot with no hidden dealer dice or deck order. */
export function createGameView(input: CreateGameViewInput = {}): GameClientView {
    const offset = pageInteger(input.activityOffset, 0, 0, Number.MAX_SAFE_INTEGER, 'activityOffset');
    const limit = pageInteger(
        input.activityLimit,
        GAME_DEFAULT_ACTIVITY_PAGE_SIZE,
        1,
        GAME_MAX_ACTIVITY_PAGE_SIZE,
        'activityLimit',
    );
    const domain = input.domain ?? createEmptyGameDomain();
    validateGameDomain(domain);
    const state = replayGameEvents(domain);
    const records = flattenGameActivities(domain).reverse();
    const activities = records.slice(offset, offset + limit).map(publicActivity);
    const activeGame = projectActiveGame(state);
    return {
        revision: domain.events.length,
        eventId: domain.events.at(-1)?.eventId ?? '',
        lockedAmount: calculateGameLockedAmount(state),
        ...(activeGame ? { activeGame } : {}),
        activities,
        activityPage: {
            offset,
            limit,
            total: records.length,
            hasMore: offset + activities.length < records.length,
        },
    };
}

export const createGamePublicView = createGameView;
