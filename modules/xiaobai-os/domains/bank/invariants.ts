import { BANK_MAX_PAYOUT } from './money.js';
import {
    createBankDepositFrozenContract,
    createBankFundFrozenContract,
    findBankDepositContract,
    findBankFundContract,
} from './products.js';
import {
    BANK_SCHEMA_VERSION,
    throwBankError,
    type BankAction,
    type BankActivity,
    type BankActivityDetail,
    type BankChange,
    type BankDepositPosition,
    type BankDomainV1,
    type BankEvent,
    type BankEventResult,
    type BankFundPosition,
    type BankState,
} from './types.js';

const MAX_DATE_MS = 8_640_000_000_000_000;
const MAX_ID_LENGTH = 200;

function invalid(detail: string): never {
    return throwBankError('bank_invalid_domain', detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactRecord(value: unknown, keys: readonly string[], detail: string): Record<string, unknown> {
    if (!isRecord(value)) {return invalid(`${detail}.shape`);}
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {return invalid(`${detail}.prototype`);}
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        return invalid(`${detail}.keys`);
    }
    return value;
}

function canonicalId(value: unknown, detail: string): string {
    if (typeof value !== 'string' || !value || value !== value.trim()
        || Array.from(value).length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
        return invalid(detail);
    }
    return value;
}

function safeInteger(value: unknown, minimum: number, detail: string): number {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) {return invalid(detail);}
    return Number(value);
}

function payout(value: unknown, detail: string): number {
    const amount = safeInteger(value, 0, detail);
    if (amount > BANK_MAX_PAYOUT) {return invalid(detail);}
    return amount;
}

function idArray(value: unknown, detail: string): string[] {
    if (!Array.isArray(value)) {return invalid(`${detail}.shape`);}
    const ids = value.map((entry, index) => canonicalId(entry, `${detail}.${index}`));
    if (new Set(ids).size !== ids.length) {return invalid(`${detail}.duplicate`);}
    return ids;
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((id) => right.includes(id));
}

function validateDepositPosition(value: unknown, detail: string): BankDepositPosition {
    const position = exactRecord(value, [
        'id', 'productId', 'principal', 'startTurn', 'maturityTurn',
        'maturityAmount', 'earlyWithdrawalAmount',
    ], detail);
    const id = canonicalId(position.id, `${detail}.id`);
    const productId = canonicalId(position.productId, `${detail}.productId`);
    const product = findBankDepositContract(productId);
    if (!product) {return invalid(`${detail}.productId`);}
    const principal = safeInteger(position.principal, 1, `${detail}.principal`);
    const startTurn = safeInteger(position.startTurn, 0, `${detail}.startTurn`);
    const maturityTurn = safeInteger(position.maturityTurn, 1, `${detail}.maturityTurn`);
    let contract;
    try {
        contract = createBankDepositFrozenContract(product, principal);
    } catch {
        return invalid(`${detail}.contract`);
    }
    if (maturityTurn !== startTurn + product.lockRounds
        || position.maturityAmount !== contract.maturityAmount
        || position.earlyWithdrawalAmount !== contract.earlyWithdrawalAmount) {
        return invalid(`${detail}.contract`);
    }
    return {
        id,
        productId: product.id,
        principal,
        startTurn,
        maturityTurn,
        ...contract,
    };
}

function validateFundPosition(value: unknown, detail: string): BankFundPosition {
    const position = exactRecord(value, [
        'id', 'productId', 'principal', 'startTurn', 'maturityTurn',
        'resolvedReturnBps', 'settlementAmount',
    ], detail);
    const id = canonicalId(position.id, `${detail}.id`);
    const productId = canonicalId(position.productId, `${detail}.productId`);
    const product = findBankFundContract(productId);
    if (!product) {return invalid(`${detail}.productId`);}
    const principal = safeInteger(position.principal, 1, `${detail}.principal`);
    const startTurn = safeInteger(position.startTurn, 0, `${detail}.startTurn`);
    const maturityTurn = safeInteger(position.maturityTurn, 1, `${detail}.maturityTurn`);
    if (!Number.isSafeInteger(position.resolvedReturnBps)) {return invalid(`${detail}.resolvedReturnBps`);}
    let contract;
    try {
        contract = createBankFundFrozenContract(product, principal, position.resolvedReturnBps);
    } catch {
        return invalid(`${detail}.contract`);
    }
    if (maturityTurn !== startTurn + product.lockRounds || position.settlementAmount !== contract.settlementAmount) {
        return invalid(`${detail}.contract`);
    }
    return {
        id,
        productId: product.id,
        principal,
        startTurn,
        maturityTurn,
        ...contract,
    };
}

export function validateBankAction(value: unknown): BankAction {
    const source = isRecord(value) ? value : {};
    const kind = source.kind;
    const base = ['kind', 'settledPositionIds'];
    const keys: Record<BankAction['kind'], readonly string[]> = {
        'deposit-open': [...base, 'productId', 'positionId', 'amount'],
        'deposit-withdraw-early': [...base, 'positionId'],
        'fund-open': [...base, 'productId', 'positionId', 'amount'],
        'settle-due': base,
    };
    if (typeof kind !== 'string' || !(kind in keys)) {return invalid('command.kind');}
    const commandKind = kind as BankAction['kind'];
    const command = exactRecord(value, keys[commandKind], 'command');
    const settledPositionIds = idArray(command.settledPositionIds, 'command.settledPositionIds');
    if (commandKind === 'deposit-open') {
        const productId = canonicalId(command.productId, 'command.productId');
        const product = findBankDepositContract(productId);
        const amount = safeInteger(command.amount, 1, 'command.amount');
        try {if (!product) {return invalid('command.productId');} createBankDepositFrozenContract(product, amount);} catch {return invalid('command.amount');}
        return { kind: commandKind, productId: product.id, positionId: canonicalId(command.positionId, 'command.positionId'), amount, settledPositionIds };
    }
    if (commandKind === 'fund-open') {
        const productId = canonicalId(command.productId, 'command.productId');
        const product = findBankFundContract(productId);
        const amount = safeInteger(command.amount, 1, 'command.amount');
        if (!product || amount < product.minAmount || amount > product.maxAmount) {return invalid('command.amount');}
        return { kind: commandKind, productId: product.id, positionId: canonicalId(command.positionId, 'command.positionId'), amount, settledPositionIds };
    }
    if (commandKind === 'deposit-withdraw-early') {
        return { kind: commandKind, positionId: canonicalId(command.positionId, 'command.positionId'), settledPositionIds };
    }
    return { kind: 'settle-due', settledPositionIds };
}

function validateActivityDetail(value: unknown, amountIn: number, paid: number): BankActivityDetail {
    const source = isRecord(value) ? value : {};
    if (source.kind === 'deposit') {
        const detail = exactRecord(value, ['kind', 'productId', 'outcome'], 'activity.detail');
        const productId = canonicalId(detail.productId, 'activity.detail.productId');
        const product = findBankDepositContract(productId);
        if (!product || (detail.outcome !== 'matured' && detail.outcome !== 'withdrawn-early')) {
            return invalid('activity.detail');
        }
        let contract;
        try {contract = createBankDepositFrozenContract(product, amountIn);} catch {return invalid('activity.detail.contract');}
        const expected = detail.outcome === 'matured' ? contract.maturityAmount : contract.earlyWithdrawalAmount;
        if (paid !== expected) {return invalid('activity.payout');}
        return { kind: 'deposit', productId: product.id, outcome: detail.outcome };
    }
    if (source.kind === 'fund') {
        const detail = exactRecord(value, ['kind', 'productId', 'resolvedReturnBps'], 'activity.detail');
        const productId = canonicalId(detail.productId, 'activity.detail.productId');
        const product = findBankFundContract(productId);
        if (!product || !Number.isSafeInteger(detail.resolvedReturnBps)) {return invalid('activity.detail');}
        let contract;
        try {contract = createBankFundFrozenContract(product, amountIn, detail.resolvedReturnBps);} catch {return invalid('activity.detail.contract');}
        if (paid !== contract.settlementAmount) {return invalid('activity.payout');}
        return { kind: 'fund', productId: product.id, resolvedReturnBps: Number(detail.resolvedReturnBps) };
    }
    return invalid('activity.detail.kind');
}

function validateActivity(value: unknown, detail: string): BankActivity {
    const activity = exactRecord(value, ['id', 'sourceId', 'detail', 'amountIn', 'payout', 'net'], detail);
    const amountIn = safeInteger(activity.amountIn, 1, `${detail}.amountIn`);
    const paid = payout(activity.payout, `${detail}.payout`);
    if (!Number.isSafeInteger(activity.net) || activity.net !== paid - amountIn) {return invalid(`${detail}.net`);}
    return {
        id: canonicalId(activity.id, `${detail}.id`),
        sourceId: canonicalId(activity.sourceId, `${detail}.sourceId`),
        detail: validateActivityDetail(activity.detail, amountIn, paid),
        amountIn,
        payout: paid,
        net: Number(activity.net),
    };
}

function validateChange(value: unknown, detail: string): BankChange {
    const source = isRecord(value) ? value : {};
    if (source.kind === 'deposit-opened') {
        const change = exactRecord(value, ['kind', 'position'], detail);
        return { kind: 'deposit-opened', position: validateDepositPosition(change.position, `${detail}.position`) };
    }
    if (source.kind === 'fund-opened') {
        const change = exactRecord(value, ['kind', 'position'], detail);
        return { kind: 'fund-opened', position: validateFundPosition(change.position, `${detail}.position`) };
    }
    if (source.kind === 'positions-closed') {
        const change = exactRecord(value, ['kind', 'positionIds'], detail);
        const positionIds = idArray(change.positionIds, `${detail}.positionIds`);
        if (positionIds.length === 0) {return invalid(`${detail}.positionIds`);}
        return { kind: 'positions-closed', positionIds };
    }
    return invalid(`${detail}.kind`);
}

export function validateBankEventResult(value: unknown): BankEventResult {
    const result = exactRecord(value, ['changes', 'activities'], 'result');
    if (!Array.isArray(result.changes) || !Array.isArray(result.activities)) {return invalid('result.arrays');}
    return {
        changes: result.changes.map((change, index) => validateChange(change, `result.changes.${index}`)),
        activities: result.activities.map((activity, index) => validateActivity(activity, `result.activities.${index}`)),
    };
}

function validateEvent(value: unknown, expectedRevision: number): BankEvent {
    const event = exactRecord(value, [
        'revision', 'eventId', 'actionId', 'command', 'result', 'assistantTurn', 'createdAt',
    ], 'event');
    if (event.revision !== expectedRevision) {return invalid('event.revision');}
    return {
        revision: expectedRevision,
        eventId: canonicalId(event.eventId, 'event.eventId'),
        actionId: canonicalId(event.actionId, 'event.actionId'),
        command: validateBankAction(event.command),
        result: validateBankEventResult(event.result),
        assistantTurn: safeInteger(event.assistantTurn, 0, 'event.assistantTurn'),
        createdAt: (() => {
            const createdAt = safeInteger(event.createdAt, 0, 'event.createdAt');
            return createdAt <= MAX_DATE_MS ? createdAt : invalid('event.createdAt');
        })(),
    };
}

function assertOpenedPosition(
    event: BankEvent,
    position: BankDepositPosition | BankFundPosition,
    command: Extract<BankAction, { kind: 'deposit-open' | 'fund-open' }>,
): void {
    if (position.id !== command.positionId || position.productId !== command.productId
        || position.principal !== command.amount || position.startTurn !== event.assistantTurn) {
        invalid('event.opened-position');
    }
}

function findActivity(activities: readonly BankActivity[], sourceId: string): BankActivity {
    const matches = activities.filter((activity) => activity.sourceId === sourceId);
    if (matches.length !== 1) {return invalid(`event.activity:${sourceId}`);}
    return matches[0] as BankActivity;
}

function assertClosedPositionActivity(
    position: BankDepositPosition | BankFundPosition,
    activity: BankActivity,
    early: boolean,
): void {
    if (activity.amountIn !== position.principal) {invalid(`event.position-activity:${position.id}`);}
    if ('maturityAmount' in position) {
        if (activity.detail.kind !== 'deposit' || activity.detail.productId !== position.productId
            || activity.detail.outcome !== (early ? 'withdrawn-early' : 'matured')
            || activity.payout !== (early ? position.earlyWithdrawalAmount : position.maturityAmount)) {
            invalid(`event.position-activity:${position.id}`);
        }
        return;
    }
    if (early || activity.detail.kind !== 'fund' || activity.detail.productId !== position.productId
        || activity.detail.resolvedReturnBps !== position.resolvedReturnBps
        || activity.payout !== position.settlementAmount) {
        invalid(`event.position-activity:${position.id}`);
    }
}

function applyValidatedEvent(
    state: BankState,
    event: BankEvent,
    entityIds: Set<string>,
    activityIds: Set<string>,
    activitySourceIds: Set<string>,
): void {
    const command = event.command;
    const changes = event.result.changes;
    const activities = event.result.activities;
    const closedChanges = changes.filter((change): change is Extract<BankChange, { kind: 'positions-closed' }> => change.kind === 'positions-closed');
    if (closedChanges.length > 1) {invalid('event.positions-closed');}
    const closedIds = closedChanges.flatMap((change) => change.positionIds);
    if (new Set(closedIds).size !== closedIds.length) {invalid('event.positions-closed');}
    const dueIds = [...state.openDeposits, ...state.openInvestments]
        .filter((position) => position.maturityTurn <= event.assistantTurn)
        .map((position) => position.id);
    if (!sameIdSet(command.settledPositionIds, dueIds)) {invalid('event.settled-position-ids');}
    const expectedClosed = [...dueIds];
    if (command.kind === 'deposit-withdraw-early') {
        const target = state.openDeposits.find((position) => position.id === command.positionId);
        if (!target || target.maturityTurn <= event.assistantTurn) {invalid('event.early-withdrawal');}
        expectedClosed.push(target.id);
    }
    if (!sameIdSet(closedIds, expectedClosed)) {invalid('event.closed-positions');}

    for (const id of closedIds) {
        const position = [...state.openDeposits, ...state.openInvestments].find((entry) => entry.id === id);
        if (!position) {invalid(`event.closed-position:${id}`);}
        assertClosedPositionActivity(position, findActivity(activities, id), id === (command.kind === 'deposit-withdraw-early' ? command.positionId : ''));
    }
    state.openDeposits = state.openDeposits.filter((position) => !closedIds.includes(position.id));
    state.openInvestments = state.openInvestments.filter((position) => !closedIds.includes(position.id));

    const targetChanges = changes.filter((change) => change.kind !== 'positions-closed');
    if (command.kind === 'deposit-open' || command.kind === 'fund-open') {
        if (targetChanges.length !== 1) {invalid('event.open-change');}
        const change = targetChanges[0];
        if (command.kind === 'deposit-open' && change?.kind === 'deposit-opened') {
            assertOpenedPosition(event, change.position, command);
            if (entityIds.has(change.position.id)) {invalid('event.entity-id');}
            entityIds.add(change.position.id);
            state.openDeposits.push(structuredClone(change.position));
        } else if (command.kind === 'fund-open' && change?.kind === 'fund-opened') {
            assertOpenedPosition(event, change.position, command);
            if (entityIds.has(change.position.id)) {invalid('event.entity-id');}
            entityIds.add(change.position.id);
            state.openInvestments.push(structuredClone(change.position));
        } else {invalid('event.open-change');}
    } else {
        if (targetChanges.length !== 0) {invalid('event.close-change');}
    }

    if (activities.length !== closedIds.length) {invalid('event.activities');}
    for (const activity of activities) {
        if (activityIds.has(activity.id) || activitySourceIds.has(activity.sourceId)) {
            invalid('event.activity-id');
        }
        if (!entityIds.has(activity.sourceId)) {invalid('event.activity-source');}
        activityIds.add(activity.id);
        activitySourceIds.add(activity.sourceId);
    }
}

export function validateBankState(value: unknown): asserts value is BankState {
    const state = exactRecord(value, ['openDeposits', 'openInvestments'], 'state');
    if (!Array.isArray(state.openDeposits) || !Array.isArray(state.openInvestments)) {invalid('state.positions');}
    const ids = new Set<string>();
    state.openDeposits.forEach((position, index) => {
        const parsed = validateDepositPosition(position, `state.openDeposits.${index}`);
        if (ids.has(parsed.id)) {invalid('state.entity-id');}
        ids.add(parsed.id);
    });
    state.openInvestments.forEach((position, index) => {
        const parsed = validateFundPosition(position, `state.openInvestments.${index}`);
        if (ids.has(parsed.id)) {invalid('state.entity-id');}
        ids.add(parsed.id);
    });
}

/** Accepts only schema v1's exact serialized shape and validates every replay transition. */
export function validateBankDomain(value: unknown): asserts value is BankDomainV1 {
    if (!isRecord(value)) {invalid('domain.shape');}
    if (value.schemaVersion !== BANK_SCHEMA_VERSION) {throwBankError('bank_unsupported_version');}
    const domain = exactRecord(value, ['schemaVersion', 'events'], 'domain');
    if (!Array.isArray(domain.events)) {invalid('domain.events');}

    const eventIds = new Set<string>();
    const actionIds = new Set<string>();
    const entityIds = new Set<string>();
    const activityIds = new Set<string>();
    const activitySourceIds = new Set<string>();
    const state: BankState = { openDeposits: [], openInvestments: [] };
    for (let index = 0; index < domain.events.length; index += 1) {
        const event = validateEvent(domain.events[index], index + 1);
        if (eventIds.has(event.eventId) || actionIds.has(event.actionId)) {invalid('event.id-duplicate');}
        eventIds.add(event.eventId);
        actionIds.add(event.actionId);
        applyValidatedEvent(state, event, entityIds, activityIds, activitySourceIds);
    }
}
