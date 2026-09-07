import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createEconomyCapabilityRegistrations,
    ECONOMY_READ_CAPABILITY,
} from '../capabilities/economy/index.js';
import { createWalletController } from '../apps/wallet/host/controller.js';
import { ensureEconomy, postTransaction } from '../domains/economy/ledger.js';
import { createKernelComposition } from '../host/kernel-composition.js';

const binding = { kind: 'character', ownerLocator: 'avatar.png', chatId: 'chat-a' };

function nextTask() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function waitForState(host, status) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const found = host.posts.findLast(item =>
            item.type === 'wallet/state' && item.payload.state.status === status,
        );
        if (found) { return found.payload.state; }
        await nextTask();
    }
    assert.fail(`Timed out waiting for Wallet state ${status}`);
}

function ledgerWithTransactions(count) {
    let id = 0;
    const dependencies = { now: () => 2_000 + id, createId: () => `fixture-${++id}` };
    let ledger = ensureEconomy(undefined, dependencies);
    for (let index = 1; index < count; index += 1) {
        ledger = postTransaction(ledger, {
            idempotencyKey: `fixture:${index}`,
            actionId: `fixture:${index}`,
            fromAccountId: 'system:mint',
            toAccountId: 'player',
            amount: 1,
            kind: 'fixture_grant',
            title: `第 ${index} 笔`,
            sourceDomain: 'fixture',
            sourceId: String(index),
        }, dependencies).ledger;
    }
    return ledger;
}

function ledgerWithGameStake() {
    let id = 0;
    const dependencies = { now: () => 3_000 + id, createId: () => `game-fixture-${++id}` };
    const opening = ensureEconomy(undefined, dependencies);
    return postTransaction(opening, {
        idempotencyKey: 'game:historical:stake',
        actionId: 'game-ui:historical:1',
        fromAccountId: 'player',
        toAccountId: 'escrow:game:historical',
        amount: 10,
        kind: 'game_stake',
        title: 'Game stake escrow',
        sourceDomain: 'game',
        sourceId: 'historical',
    }, dependencies).ledger;
}

async function createHarness({ openingResult = 'confirmed', ledger = null } = {}) {
    let generatedId = 0;
    const host = {
        identity: { key: 'character:avatar.png:chat-a', chatId: 'chat-a' },
        posts: [],
        writes: 0,
        persisted: ledger ? {
            formatVersion: 1,
            osId: 'economy_os',
            binding,
            revision: 0,
            commitId: 'economy_commit_0',
            partitions: { economy: structuredClone(ledger) },
        } : null,
    };
    const capture = {
        identityKey: host.identity.key,
        binding,
        reference: ledger ? { formatVersion: 1, osId: 'economy_os' } : null,
    };
    const composition = createKernelComposition({
        storage: {
            read: async () => structuredClone(host.persisted),
            async replace({ candidate }) {
                host.writes += 1;
                if (openingResult === 'failed') {
                    return {
                        status: 'failed',
                        error: { code: 'storage_unavailable', message: 'save unavailable', retryable: true },
                    };
                }
                if (openingResult === 'unconfirmed' && host.writes === 1) {
                    host.persisted = structuredClone(candidate);
                    return { status: 'unconfirmed', observed: null };
                }
                host.persisted = structuredClone(candidate);
                return { status: 'confirmed' };
            },
            delete: async () => 'deleted',
        },
        chatReferences: {
            capture: () => ({ ...structuredClone(capture), identityKey: host.identity.key }),
            isCurrent: captured => captured.identityKey === host.identity.key,
            async install(_captured, reference) {
                capture.reference = structuredClone(reference);
                return { status: 'confirmed' };
            },
        },
        capabilities: createEconomyCapabilityRegistrations(),
        modules: [],
        createId: () => `economy_generated_${++generatedId}`,
    });
    await composition.install();
    await composition.transactions.refresh();
    const economy = composition.capabilities.require(ECONOMY_READ_CAPABILITY);
    const controller = createWalletController({
        economy,
        confirmPending: composition.transactions.retryPending,
        getChatIdentity: () => host.identity,
    });
    controller.startBackground();
    return { composition, controller, economy, host };
}

function activation(host) {
    return { post: (type, payload) => { host.posts.push({ type, payload }); return true; } };
}

test('Wallet opens explicitly once while existing Economy data is read-only', async () => {
    const fresh = await createHarness();
    const loading = await fresh.controller.activate(activation(fresh.host));
    assert.equal(loading.status, 'loading');
    assert.equal(loading.balance, 0);
    assert.equal(fresh.host.writes, 0);

    const ready = await waitForState(fresh.host, 'ready');
    assert.equal(ready.balance, 100);
    assert.equal(ready.transactions[0].title, '开户赠礼');
    assert.equal(fresh.host.writes, 1);
    await fresh.controller.handleMessage({
        type: 'wallet/refresh',
        payload: { chatIdentity: fresh.host.identity.key },
    });
    assert.equal(fresh.host.writes, 1);

    const existing = await createHarness({ ledger: ledgerWithTransactions(2) });
    const existingState = await existing.controller.activate(activation(existing.host));
    assert.equal(existingState.status, 'ready');
    assert.equal(existingState.balance, 101);
    assert.equal(existing.host.writes, 0);
});

test('Wallet localizes canonical transactions without exposing a write capability', async () => {
    const ledger = ledgerWithGameStake();
    const harness = await createHarness({ ledger });
    const state = await harness.controller.activate(activation(harness.host));

    assert.equal(state.transactions[0].title, '游戏下注');
    assert.equal(ledger.transactions.find(transaction => transaction.sourceDomain === 'game').title, 'Game stake escrow');
    assert.equal(harness.economy.postAction, undefined);
    await assert.rejects(
        harness.controller.handleMessage({
            type: 'wallet/post',
            payload: { chatIdentity: harness.host.identity.key },
        }),
        /未知的钱包操作/,
    );
});

test('Wallet confirms an uncertain opening through Kernel recovery without minting twice', async () => {
    const harness = await createHarness({ openingResult: 'unconfirmed' });
    await harness.controller.activate(activation(harness.host));
    const pending = await waitForState(harness.host, 'unconfirmed');

    assert.equal(pending.balance, 0);
    assert.equal(pending.transactions.length, 0);
    assert.equal(harness.host.writes, 1);
    await assert.rejects(harness.controller.handleMessage({
        type: 'wallet/confirm-save',
        payload: { chatIdentity: 'another-chat' },
    }), /聊天已切换/);
    const recovery = await harness.controller.handleMessage({
        type: 'wallet/confirm-save',
        payload: { chatIdentity: harness.host.identity.key },
    });
    assert.equal(recovery.confirmation, 'confirmed');
    assert.equal(recovery.state.balance, 100);
    const ready = await waitForState(harness.host, 'ready');
    assert.equal(ready.balance, 100);
    assert.equal(harness.host.writes, 1);
});

test('an explicitly failed opening remains blocked and does not publish candidate money', async () => {
    const harness = await createHarness({ openingResult: 'failed' });
    const loading = await harness.controller.activate(activation(harness.host));
    assert.equal(loading.status, 'loading');
    const failed = await waitForState(harness.host, 'blocked');

    assert.equal(failed.balance, 0);
    assert.equal(harness.economy.isOpen(), false);
    assert.equal(harness.economy.getFileState(), 'ready');
});

test('Wallet invalidates on chat change and paginates the confirmed ledger', async () => {
    const harness = await createHarness({ ledger: ledgerWithTransactions(22) });
    const state = await harness.controller.activate(activation(harness.host));
    assert.deepEqual(state.transactions.map(transaction => transaction.sequence), [
        22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
    ]);
    const page = await harness.controller.handleMessage({
        type: 'wallet/load-more',
        payload: { chatIdentity: harness.host.identity.key, beforeSequence: state.nextCursor },
    });
    assert.deepEqual(page.transactions.map(transaction => transaction.sequence), [4, 3, 2, 1]);

    harness.host.identity = { key: 'character:avatar.png:chat-b', chatId: 'chat-b' };
    await assert.rejects(
        harness.controller.handleMessage({
            type: 'wallet/refresh',
            payload: { chatIdentity: 'character:avatar.png:chat-a' },
        }),
        /聊天已切换/,
    );
    harness.controller.handleChatChanged();
    await assert.rejects(
        harness.controller.handleMessage({
            type: 'wallet/refresh',
            payload: { chatIdentity: 'character:avatar.png:chat-a' },
        }),
        /钱包 APP 未激活/,
    );
});
