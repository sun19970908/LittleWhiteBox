import { validateGameAction, validateGameDomain, validateGameState } from './invariants.js';
import {
    GAME_SCHEMA_VERSION,
    throwGameError,
    type GameAction,
    type GameActivityRecord,
    type GameAppendEventInput,
    type GameCasToken,
    type GameChange,
    type GameCommandResult,
    type GameDomainV1,
    type GameEvent,
    type GameState,
} from './types.js';

const MAX_DATE_MS = 8_640_000_000_000_000;

export function createEmptyGameDomain(): GameDomainV1 {
    return { schemaVersion: GAME_SCHEMA_VERSION, events: [] };
}

export function createEmptyGameState(): GameState {
    return {};
}

function applyChange(state: GameState, change: GameChange): void {
    if (change.kind === 'game-started' || change.kind === 'game-advanced') {
        state.activeGame = structuredClone(change.game);
    } else {
        delete state.activeGame;
    }
}

/** Rebuilds current private state without retaining references to persisted events. */
export function replayGameEvents(domain: GameDomainV1): GameState {
    validateGameDomain(domain);
    const state = createEmptyGameState();
    for (const event of domain.events) {
        for (const change of event.result.changes) {applyChange(state, change);}
    }
    return state;
}

export const replayGameState = replayGameEvents;

/** Flattens embedded terminal facts in chronological order with their event boundary. */
export function flattenGameActivities(domain: GameDomainV1): GameActivityRecord[] {
    validateGameDomain(domain);
    return domain.events.flatMap((event) => event.result.activities.map((activity) => ({
        ...structuredClone(activity),
        revision: event.revision,
        eventId: event.eventId,
        actionId: event.actionId,
        createdAt: event.createdAt,
    })));
}

export function getGameCasToken(domain: GameDomainV1): GameCasToken {
    validateGameDomain(domain);
    return {
        expectedRevision: domain.events.length,
        expectedEventId: domain.events.at(-1)?.eventId ?? '',
    };
}

function canonicalJson(value: unknown): string {
    return JSON.stringify(value, (_key, entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {return entry;}
        return Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([left], [right]) => (
            left.localeCompare(right)
        )));
    });
}

function sameAction(left: GameAction, right: GameAction): boolean {
    return canonicalJson(left) === canonicalJson(right);
}

function requireCasToken(input: GameCasToken): void {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
        || typeof input.expectedEventId !== 'string'
        || input.expectedEventId !== input.expectedEventId.trim()
        || Array.from(input.expectedEventId).length > 200
        || (input.expectedRevision === 0) !== (input.expectedEventId === '')) {
        throwGameError('game_invalid_context', 'cas');
    }
}

function requireAppendContext(input: GameAppendEventInput): void {
    if (typeof input.actionId !== 'string' || !input.actionId || input.actionId !== input.actionId.trim()
        || Array.from(input.actionId).length > 200
        || /[\u0000-\u001f\u007f-\u009f]/u.test(input.actionId)) {
        throwGameError('game_action_required');
    }
    if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0 || input.createdAt > MAX_DATE_MS) {
        throwGameError('game_invalid_context', 'event');
    }
}

function assertCas(domain: GameDomainV1, input: GameCasToken): void {
    if (input.expectedRevision !== domain.events.length) {throwGameError('game_revision_conflict');}
    if (input.expectedEventId !== (domain.events.at(-1)?.eventId ?? '')) {
        throwGameError('game_event_id_conflict');
    }
}

/** Replays an existing action before CAS; the persisted result remains authoritative. */
export function appendGameEvent(domain: GameDomainV1, input: GameAppendEventInput): GameCommandResult {
    validateGameDomain(domain);
    requireCasToken(input);
    requireAppendContext(input);
    const command = validateGameAction(input.command);
    const existing = domain.events.find((event) => event.actionId === input.actionId);
    if (existing) {
        if (!sameAction(existing.command, command)) {throwGameError('game_action_conflict');}
        const current = structuredClone(domain);
        return {
            domain: current,
            event: structuredClone(existing),
            state: replayGameEvents(current),
            created: false,
        };
    }
    assertCas(domain, input);
    const event: GameEvent = {
        revision: domain.events.length + 1,
        eventId: input.eventId,
        actionId: input.actionId,
        command,
        result: structuredClone(input.result),
        createdAt: input.createdAt,
    };
    const next: GameDomainV1 = {
        schemaVersion: GAME_SCHEMA_VERSION,
        events: [...structuredClone(domain.events), event],
    };
    validateGameDomain(next);
    return {
        domain: next,
        event: structuredClone(event),
        state: replayGameEvents(next),
        created: true,
    };
}

export function calculateGameLockedAmount(state: GameState): number {
    validateGameState(state);
    const locked = state.activeGame?.game.bet ?? 0;
    if (!Number.isSafeInteger(locked) || locked < 0) {
        throwGameError('game_invalid_domain', 'locked-amount');
    }
    return locked;
}
