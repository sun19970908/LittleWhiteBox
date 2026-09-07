import type {
    EconomyActionLeg,
    EconomyTransactionCapability,
} from '../../../capabilities/economy/index.js';
import { validateTaskDomain } from '../../../domains/tasks/invariants.js';
import { replayTaskEvents, visitProjectedTaskEvents } from '../../../domains/tasks/projection.js';
import { TaskError, type TaskDomainV1, type TaskEvent, type TaskRecord } from '../../../domains/tasks/types.js';

export const TASKS_ECONOMY_ACCOUNT_NAMESPACE = 'task';
const TASK_ESCROW_PREFIX = `escrow:${TASKS_ECONOMY_ACCOUNT_NAMESPACE}:`;
const TASK_COUNTERPARTY_PREFIX = `counterparty:${TASKS_ECONOMY_ACCOUNT_NAMESPACE}:`;

function inconsistent(detail: string): never {
    throw new TaskError('task_invalid_domain', `economy.${detail}`);
}

export function taskEscrowAccount(taskId: string): string {
    return `${TASK_ESCROW_PREFIX}${taskId}`;
}

export function taskCounterpartyAccount(partyId: string): string {
    return `${TASK_COUNTERPARTY_PREFIX}${partyId}`;
}

function transactionKind(event: TaskEvent): 'funding' | 'settlement' | 'refund' | null {
    if (event.kind === 'accepted' || event.kind === 'published') { return 'funding'; }
    if (event.kind === 'completed') { return 'settlement'; }
    if (event.kind === 'failed' || event.kind === 'cancelled') { return 'refund'; }
    return null;
}

export function buildTaskEconomyLeg(
    event: TaskEvent,
    record: Readonly<TaskRecord>,
): EconomyActionLeg | null {
    const kind = transactionKind(event);
    if (!kind) { return null; }
    const escrow = taskEscrowAccount(event.taskId);
    let fromAccountId: string;
    let toAccountId: string;
    let title: string;
    if (kind === 'funding') {
        fromAccountId = event.kind === 'accepted'
            ? taskCounterpartyAccount(event.issuer.partyId)
            : 'player';
        toAccountId = escrow;
        title = '任务报酬托管';
    } else if (kind === 'settlement') {
        if (!record.assignee) { return inconsistent(`assignee:${event.taskId}`); }
        fromAccountId = escrow;
        toAccountId = record.assignee.kind === 'player'
            ? 'player'
            : taskCounterpartyAccount(record.assignee.partyId);
        title = '任务完成结算';
    } else {
        fromAccountId = escrow;
        toAccountId = record.issuer.kind === 'player'
            ? 'player'
            : taskCounterpartyAccount(record.issuer.partyId);
        title = '任务报酬退回';
    }
    return {
        idempotencyKey: `tasks:event:${event.eventId}:${kind}`,
        actionId: event.actionId,
        fromAccountId,
        toAccountId,
        amount: record.reward,
        kind: `task_${kind}`,
        title,
        sourceId: event.taskId,
    };
}

export function postTaskEconomyEvent(
    economy: EconomyTransactionCapability,
    event: TaskEvent,
    record: Readonly<TaskRecord>,
): void {
    const leg = buildTaskEconomyLeg(event, record);
    if (leg) { economy.postAction({ legs: [leg] }); }
}

function expectedTransactions(domain: TaskDomainV1): EconomyActionLeg[] {
    const expected: EconomyActionLeg[] = [];
    visitProjectedTaskEvents(domain.events, (event, record) => {
        const transaction = buildTaskEconomyLeg(event, record);
        if (transaction) { expected.push(transaction); }
    });
    return expected;
}

function sameTransaction(
    actual: ReturnType<EconomyTransactionCapability['listOwnedTransactions']>[number],
    expected: EconomyActionLeg,
): boolean {
    return actual.idempotencyKey === expected.idempotencyKey
        && actual.actionId === expected.actionId
        && actual.fromAccountId === expected.fromAccountId
        && actual.toAccountId === expected.toAccountId
        && actual.amount === expected.amount
        && actual.kind === expected.kind
        && actual.title === expected.title
        && actual.note === (expected.note ?? '')
        && actual.sourceDomain === 'tasks'
        && actual.sourceId === expected.sourceId
        && actual.reversalOfTransactionId === undefined;
}

export function validateTaskEconomyConsistency(
    domain: TaskDomainV1,
    economy: EconomyTransactionCapability,
): void {
    validateTaskDomain(domain);
    const expected = expectedTransactions(domain);
    const actual = economy.listOwnedTransactions();
    if (actual.length !== expected.length) { inconsistent('transaction-count'); }
    for (let index = 0; index < expected.length; index += 1) {
        if (!sameTransaction(actual[index], expected[index])) {
            inconsistent(`transaction:${expected[index]?.actionId ?? index}`);
        }
    }
    for (const record of replayTaskEvents(domain.events)) {
        const expectedEscrow = record.status === 'recruiting' || record.status === 'active' ? record.reward : 0;
        if (economy.getAccountBalance(taskEscrowAccount(record.taskId)) !== expectedEscrow) {
            inconsistent(`escrow:${record.taskId}`);
        }
    }
}
