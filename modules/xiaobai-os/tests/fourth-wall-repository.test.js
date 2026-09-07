import assert from 'node:assert/strict';
import test from 'node:test';

import { createFourthWallRepository } from '../apps/fourth-wall/host/repository.js';
import { createDefaultFourthWallChatState } from '../apps/fourth-wall/domain/defaults.js';
import { FOURTH_WALL_PARTITION } from '../apps/fourth-wall/partition.js';
import { XiaobaiOsPartitionRegistry } from '../kernel/partition-registry.js';
import { createTransactionCoordinator } from '../kernel/transaction-coordinator.js';

const bindings = {
    a: { kind: 'character', ownerLocator: 'avatar.png', chatId: 'chat-a' },
    b: { kind: 'character', ownerLocator: 'avatar.png', chatId: 'chat-b' },
};

function createHarness({ upgradeSource } = {}) {
    let id = 0;
    const captures = {
        a: { identityKey: 'character:avatar.png:chat-a', binding: bindings.a, reference: null },
        b: { identityKey: 'character:avatar.png:chat-b', binding: bindings.b, reference: null },
    };
    const state = {
        current: 'a',
        files: new Map(),
        writes: [],
        installs: 0,
        replaceImpl: null,
    };
    const storage = {
        async read(osId) {
            return structuredClone(state.files.get(osId) ?? null);
        },
        async replace(input) {
            state.writes.push(structuredClone(input));
            if (state.replaceImpl) { return await state.replaceImpl(input); }
            state.files.set(input.candidate.osId, structuredClone(input.candidate));
            return { status: 'confirmed' };
        },
        async delete(osId) {
            return state.files.delete(osId) ? 'deleted' : 'missing';
        },
    };
    const chatReferences = {
        capture: () => structuredClone(captures[state.current]),
        isCurrent: captured => captured.identityKey === captures[state.current].identityKey,
        async install(captured, reference) {
            if (captured.identityKey !== captures[state.current].identityKey) {
                return {
                    status: 'failed',
                    error: { code: 'chat_changed', message: 'chat changed', retryable: true },
                };
            }
            state.installs += 1;
            captures[state.current].reference = structuredClone(reference);
            return { status: 'confirmed' };
        },
    };
    const partitions = new XiaobaiOsPartitionRegistry();
    partitions.register(FOURTH_WALL_PARTITION);
    const coordinator = createTransactionCoordinator({
        storage,
        partitions,
        chatReferences,
        createId: () => `fw_generated_${++id}`,
    });
    const store = coordinator.createScopedStore(FOURTH_WALL_PARTITION);
    const repository = createFourthWallRepository(store, { now: () => 1000, upgradeSource });
    return { captures, coordinator, repository, state };
}

test('opening an empty Fourth Wall returns a local default without creating sidecar data', async () => {
    const harness = createHarness();

    assert.equal(harness.repository.readCurrentChatFourthWall(), null);
    const opened = await harness.repository.prepareCurrentChatFourthWall();
    assert.equal(opened.activeSessionId, 'default');
    assert.equal(harness.repository.readCurrentChatFourthWall(), null);
    assert.equal(harness.state.writes.length, 0);
    assert.equal(harness.state.installs, 0);
});

test('the first Fourth Wall open and mutation project upstream history before a sidecar exists', async () => {
    const upstream = createDefaultFourthWallChatState(900);
    upstream.sessions[0].name = 'Upstream session';
    upstream.sessions[0].history.push({ role: 'user', content: 'preserve me', ts: 901 });
    const upgradeSource = {
        readCurrentPartition: () => ({
            identityKey: 'character:avatar.png:chat-a',
            partition: { schemaVersion: 1, state: structuredClone(upstream) },
        }),
    };
    const openedHarness = createHarness({ upgradeSource });

    const opened = await openedHarness.repository.prepareCurrentChatFourthWall();
    assert.equal(opened.sessions[0].history[0].content, 'preserve me');
    assert.equal(openedHarness.state.writes.length, 0);

    const mutationHarness = createHarness({ upgradeSource });
    const changed = await mutationHarness.repository.mutateCurrentChatFourthWall(current => {
        current.sessions[0].name = 'Renamed after import';
        return current;
    });
    assert.equal(changed.sessions[0].history[0].content, 'preserve me');
    assert.equal(changed.sessions[0].name, 'Renamed after import');
    assert.equal(mutationHarness.state.writes.length, 1);
});

test('the first Fourth Wall mutation writes only its partition and then installs the chat reference', async () => {
    const harness = createHarness();
    const next = await harness.repository.mutateCurrentChatFourthWall(current => {
        current.sessions[0].history.push({ role: 'user', content: 'hello', ts: 1001 });
        return current;
    });

    assert.equal(next.sessions[0].history[0].content, 'hello');
    assert.equal(harness.state.writes.length, 1);
    assert.equal(harness.state.installs, 1);
    assert.deepEqual(Object.keys(harness.state.writes[0].candidate.partitions), ['fourthWall']);
    assert.equal(harness.state.writes[0].candidate.partitions.fourthWall.schemaVersion, 1);
});

test('Fourth Wall preserves unrelated opaque partitions and isolates chats by sidecar identity', async () => {
    const harness = createHarness();
    await harness.repository.mutateCurrentChatFourthWall(current => {
        current.sessions[0].name = 'Chat A';
        return current;
    });
    const fileA = harness.captures.a.reference.osId;
    harness.state.files.get(fileA).partitions.broken = { malformed: ['keep', 1] };

    harness.state.current = 'b';
    const chatB = await harness.repository.prepareCurrentChatFourthWall();
    assert.equal(chatB.sessions[0].name, 'Default');
    await harness.repository.mutateCurrentChatFourthWall(current => {
        current.sessions[0].name = 'Chat B';
        return current;
    });

    harness.state.current = 'a';
    const chatA = await harness.repository.prepareCurrentChatFourthWall();
    assert.equal(chatA.sessions[0].name, 'Chat A');
    assert.deepEqual(harness.state.files.get(fileA).partitions.broken, { malformed: ['keep', 1] });
});

test('failed and unconfirmed writes never replace the confirmed Fourth Wall projection', async () => {
    const harness = createHarness();
    await harness.repository.mutateCurrentChatFourthWall(current => {
        current.sessions[0].name = 'Confirmed';
        return current;
    });
    const confirmed = structuredClone(harness.repository.readCurrentChatFourthWall());

    harness.state.replaceImpl = async () => ({
        status: 'failed',
        error: { code: 'storage_rejected', message: 'rejected', retryable: false },
    });
    await assert.rejects(
        harness.repository.mutateCurrentChatFourthWall(current => {
            current.sessions[0].name = 'Rejected';
            return current;
        }),
        error => error.code === 'storage_rejected',
    );
    assert.deepEqual(harness.repository.readCurrentChatFourthWall(), confirmed);

    harness.state.replaceImpl = async input => ({
        status: 'unconfirmed',
        observed: structuredClone(harness.state.files.get(input.candidate.osId)),
    });
    await assert.rejects(
        harness.repository.mutateCurrentChatFourthWall(current => {
            current.sessions[0].name = 'Pending';
            return current;
        }),
        error => error.code === 'storage_unconfirmed' && error.uncertain === true,
    );
    assert.deepEqual(harness.repository.readCurrentChatFourthWall(), confirmed);
});

test('an invalid Fourth Wall partition fails locally without touching the file', async () => {
    const harness = createHarness();
    harness.captures.a.reference = { formatVersion: 1, osId: 'invalid_fw' };
    harness.state.files.set('invalid_fw', {
        formatVersion: 1,
        osId: 'invalid_fw',
        binding: bindings.a,
        revision: 0,
        commitId: 'invalid_commit',
        partitions: {
            fourthWall: { schemaVersion: 1, state: { invalid: true } },
            unrelated: { keep: true },
        },
    });

    await assert.rejects(harness.repository.prepareCurrentChatFourthWall(), /non-canonical fields/);
    assert.equal(harness.state.writes.length, 0);
    assert.deepEqual(harness.state.files.get('invalid_fw').partitions.unrelated, { keep: true });
});
