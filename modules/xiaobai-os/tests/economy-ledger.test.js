import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ensureEconomy,
    postAction,
    postTransaction,
    projectBalances,
    reverseTransaction,
} from '../domains/economy/ledger.js';
import { validateLedger } from '../domains/economy/invariants.js';

function dependencies() {
    let id = 0;
    return { now: () => 1000 + id, createId: () => `tx-${++id}` };
}

test('economy opens once with 100 coins and never persists a second balance fact', () => {
    const deps = dependencies();
    const ledger = ensureEconomy(undefined, deps);
    assert.equal(ledger.transactions.length, 1);
    assert.equal(projectBalances(ledger).player, 100);
    assert.deepEqual(ensureEconomy(ledger, deps), ledger);
    assert.equal(Object.hasOwn(ledger, 'balance'), false);
});

test('current Economy persistence rejects fields removed with story anchoring', () => {
    const ledger = ensureEconomy(undefined, dependencies());
    ledger.transactions[0].anchor = { floor: -1, prefixHash: 'obsolete' };
    assert.throws(
        () => validateLedger(ledger),
        error => error.code === 'economy_invalid_ledger',
    );
});

test('posting is idempotent, rejects conflicting retries and prevents overdraft', () => {
    const deps = dependencies();
    const ledger = ensureEconomy(undefined, deps);
    const input = {
        idempotencyKey: 'shop:purchase:1:payment',
        actionId: 'shop:purchase:1',
        fromAccountId: 'player',
        toAccountId: 'counterparty:shop:one',
        amount: 30,
        kind: 'purchase',
        title: '购买礼物',
        sourceDomain: 'shop',
        sourceId: 'purchase:1',
    };
    const posted = postTransaction(ledger, input, deps);
    assert.equal(projectBalances(posted.ledger).player, 70);
    const replay = postTransaction(posted.ledger, input, deps);
    assert.equal(replay.created, false);
    assert.equal(replay.ledger.transactions.length, 2);
    assert.throws(
        () => postTransaction(posted.ledger, { ...input, amount: 31 }, deps),
        error => error.code === 'economy_idempotency_conflict',
    );
    assert.throws(
        () => postTransaction(posted.ledger, {
            ...input,
            idempotencyKey: 'shop:purchase:2:payment',
            actionId: 'shop:purchase:2',
            sourceId: 'purchase:2',
            amount: 100,
        }, deps),
        error => error.code === 'economy_insufficient_funds',
    );
});

test('multi-leg actions stay contiguous and a reversal appends immutable history', () => {
    const deps = dependencies();
    let ledger = ensureEconomy(undefined, deps);
    const fundingInputs = [{
        idempotencyKey: 'task:1:escrow-in',
        actionId: 'task:1:fund',
        fromAccountId: 'player',
        toAccountId: 'escrow:task:one',
        amount: 20,
        kind: 'escrow',
        title: '任务托管',
        sourceDomain: 'task',
        sourceId: 'task:one',
    }, {
        idempotencyKey: 'task:1:escrow-out',
        actionId: 'task:1:fund',
        fromAccountId: 'escrow:task:one',
        toAccountId: 'counterparty:task:issuer',
        amount: 5,
        kind: 'fee',
        title: '任务手续费',
        sourceDomain: 'task',
        sourceId: 'task:one',
    }];
    const funded = postAction(ledger, fundingInputs, deps);
    assert.equal(funded.created, true);
    assert.equal(funded.transactions.length, 2);
    assert.equal(ledger.transactions.length, 1);
    ledger = funded.ledger;
    const replay = postAction(ledger, fundingInputs, deps);
    assert.equal(replay.created, false);
    assert.deepEqual(replay.ledger, ledger);
    assert.throws(
        () => postAction(ledger, [...fundingInputs].reverse(), deps),
        error => error.code === 'economy_partial_action',
    );
    assert.throws(
        () => postAction(ledger, [fundingInputs[0]], deps),
        error => error.code === 'economy_partial_action',
    );
    const purchase = postTransaction(ledger, {
        idempotencyKey: 'shop:2:payment',
        actionId: 'shop:2',
        fromAccountId: 'player',
        toAccountId: 'counterparty:shop:two',
        amount: 10,
        kind: 'purchase',
        title: '购买物品',
        sourceDomain: 'shop',
        sourceId: 'purchase:two',
    }, deps);
    ledger = purchase.ledger;

    assert.throws(() => postTransaction(ledger, {
        idempotencyKey: 'task:1:late-leg',
        actionId: 'task:1:fund',
        fromAccountId: 'escrow:task:one',
        toAccountId: 'player',
        amount: 1,
        kind: 'refund',
        title: '迟到资金腿',
        sourceDomain: 'task',
        sourceId: 'task:one',
    }, deps), error => error.code === 'economy_non_contiguous_action');

    const reversed = reverseTransaction(ledger, {
        transactionId: purchase.transaction.id,
        idempotencyKey: 'shop:2:refund',
        actionId: 'shop:2:refund',
        title: '购买退款',
        sourceDomain: 'shop',
        sourceId: 'purchase:two',
    }, deps);
    assert.equal(reversed.transaction.reversalOfTransactionId, purchase.transaction.id);
    assert.equal(projectBalances(reversed.ledger).player, projectBalances(ledger).player + 10);
    assert.equal(reversed.ledger.transactions[3].amount, 10);
});

test('an action batch rejects partial replay and the opening grant cannot be reversed', () => {
    const deps = dependencies();
    const ledger = ensureEconomy(undefined, deps);
    const firstLeg = {
        idempotencyKey: 'task:partial:hold',
        actionId: 'task:partial',
        fromAccountId: 'player',
        toAccountId: 'escrow:task:partial',
        amount: 10,
        kind: 'escrow',
        title: '托管',
        sourceDomain: 'task',
        sourceId: 'partial',
    };
    const partial = postTransaction(ledger, firstLeg, deps).ledger;
    assert.throws(() => postAction(partial, [firstLeg, {
        ...firstLeg,
        idempotencyKey: 'task:partial:fee',
        fromAccountId: 'escrow:task:partial',
        toAccountId: 'counterparty:task:issuer',
        amount: 1,
    }], deps), error => error.code === 'economy_partial_action');

    const opening = ledger.transactions[0];
    assert.throws(() => postTransaction(ledger, {
        idempotencyKey: 'economy:illegal-opening-reversal',
        actionId: 'economy:illegal-opening-reversal',
        fromAccountId: 'player',
        toAccountId: 'system:mint',
        amount: 100,
        kind: 'reversal',
        title: '非法撤销开户',
        sourceDomain: 'economy',
        sourceId: 'illegal-opening-reversal',
        reversalOfTransactionId: opening.id,
    }, deps), error => error.code === 'economy_invalid_reversal');
});

test('the reserved opening action cannot mint a second grant and reversal metadata stays explicit', () => {
    const deps = dependencies();
    const ledger = ensureEconomy(undefined, deps);

    assert.throws(() => postTransaction(ledger, {
        idempotencyKey: 'economy:opening-grant:second',
        actionId: 'economy:opening-grant:v1',
        fromAccountId: 'system:mint',
        toAccountId: 'player',
        amount: 1,
        kind: 'opening_grant',
        title: '重复开户',
        sourceDomain: 'economy',
        sourceId: 'opening-grant:v1',
    }, deps), error => error.code === 'economy_invalid_opening_grant');

    assert.throws(() => postTransaction(ledger, {
        idempotencyKey: 'economy:fake-reversal',
        actionId: 'economy:fake-reversal',
        fromAccountId: 'player',
        toAccountId: 'system:sink',
        amount: 1,
        kind: 'reversal',
        title: '无目标冲正',
        sourceDomain: 'economy',
        sourceId: 'fake-reversal',
    }, deps), error => error.code === 'economy_invalid_reversal');
});
