import { validateBankAction, validateBankDomain, validateBankState } from './invariants.js';
import {
    BANK_SCHEMA_VERSION,
    throwBankError,
    type BankAction,
    type BankActivityRecord,
    type BankAppendEventInput,
    type BankCasToken,
    type BankChange,
    type BankCommandResult,
    type BankDomainV1,
    type BankEvent,
    type BankState,
} from './types.js';

const MAX_DATE_MS = 8_640_000_000_000_000;

export function createEmptyBankDomain(): BankDomainV1 {
    return { schemaVersion: BANK_SCHEMA_VERSION, events: [] };
}

export function createEmptyBankState(): BankState {
    return { openDeposits: [], openInvestments: [] };
}

function applyChange(state: BankState, change: BankChange): void {
    if (change.kind === 'deposit-opened') {
        state.openDeposits.push(structuredClone(change.position));
    } else if (change.kind === 'fund-opened') {
        state.openInvestments.push(structuredClone(change.position));
    } else if (change.kind === 'positions-closed') {
        state.openDeposits = state.openDeposits.filter((position) => !change.positionIds.includes(position.id));
        state.openInvestments = state.openInvestments.filter((position) => !change.positionIds.includes(position.id));
    }
}

/** Rebuilds current private state without retaining references to persisted events. */
export function replayBankEvents(domain: BankDomainV1): BankState {
    validateBankDomain(domain);
    const state = createEmptyBankState();
    for (const event of domain.events) {
        for (const change of event.result.changes) {applyChange(state, change);}
    }
    return state;
}

export const replayBankState = replayBankEvents;

/** Flattens embedded facts in chronological order and inherits their event boundary. */
export function flattenBankActivities(domain: BankDomainV1): BankActivityRecord[] {
    validateBankDomain(domain);
    return domain.events.flatMap((event) => event.result.activities.map((activity) => ({
        ...structuredClone(activity),
        revision: event.revision,
        eventId: event.eventId,
        actionId: event.actionId,
        assistantTurn: event.assistantTurn,
        createdAt: event.createdAt,
    })));
}

export function getBankCasToken(domain: BankDomainV1): BankCasToken {
    validateBankDomain(domain);
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

function sameAction(left: BankAction, right: BankAction): boolean {
    return canonicalJson(left) === canonicalJson(right);
}

function requireCasToken(input: BankCasToken): void {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
        || typeof input.expectedEventId !== 'string'
        || input.expectedEventId !== input.expectedEventId.trim()
        || Array.from(input.expectedEventId).length > 200
        || (input.expectedRevision === 0) !== (input.expectedEventId === '')) {
        throwBankError('bank_invalid_context', 'cas');
    }
}

function requireAppendContext(input: BankAppendEventInput): void {
    if (typeof input.actionId !== 'string' || !input.actionId || input.actionId !== input.actionId.trim()
        || Array.from(input.actionId).length > 200
        || /[\u0000-\u001f\u007f-\u009f]/u.test(input.actionId)) {
        throwBankError('bank_action_required');
    }
    if (!Number.isSafeInteger(input.assistantTurn) || input.assistantTurn < 0
        || !Number.isSafeInteger(input.createdAt) || input.createdAt < 0 || input.createdAt > MAX_DATE_MS) {
        throwBankError('bank_invalid_context', 'event');
    }
}

function assertCas(domain: BankDomainV1, input: BankCasToken): void {
    if (input.expectedRevision !== domain.events.length) {throwBankError('bank_revision_conflict');}
    if (input.expectedEventId !== (domain.events.at(-1)?.eventId ?? '')) {
        throwBankError('bank_event_id_conflict');
    }
}

/**
 * Appends one complete event. Existing actionIds replay before CAS and compare
 * only the canonical command, because the stored result is authoritative.
 */
export function appendBankEvent(domain: BankDomainV1, input: BankAppendEventInput): BankCommandResult {
    validateBankDomain(domain);
    requireCasToken(input);
    requireAppendContext(input);
    const command = validateBankAction(input.command);
    const existing = domain.events.find((event) => event.actionId === input.actionId);
    if (existing) {
        if (!sameAction(existing.command, command)) {throwBankError('bank_action_conflict');}
        const current = structuredClone(domain);
        return {
            domain: current,
            event: structuredClone(existing),
            state: replayBankEvents(current),
            created: false,
        };
    }
    assertCas(domain, input);
    const event: BankEvent = {
        revision: domain.events.length + 1,
        eventId: input.eventId,
        actionId: input.actionId,
        command,
        result: structuredClone(input.result),
        assistantTurn: input.assistantTurn,
        createdAt: input.createdAt,
    };
    const next: BankDomainV1 = {
        schemaVersion: BANK_SCHEMA_VERSION,
        events: [...structuredClone(domain.events), event],
    };
    validateBankDomain(next);
    return {
        domain: next,
        event: structuredClone(event),
        state: replayBankEvents(next),
        created: true,
    };
}

export function calculateBankLockedAmount(state: BankState): number {
    validateBankState(state);
    const locked = [...state.openDeposits, ...state.openInvestments]
        .reduce((total, position) => total + position.principal, 0);
    if (!Number.isSafeInteger(locked) || locked < 0) {throwBankError('bank_invalid_domain', 'locked-amount');}
    return locked;
}
