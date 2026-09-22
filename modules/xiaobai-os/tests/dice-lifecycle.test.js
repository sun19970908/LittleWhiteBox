import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createKernelComposition } from '../host/kernel-composition.ts';
import { createSettingsRepository } from '../host/settings-repository.ts';
import { createEconomyCapabilityRegistrations, ECONOMY_PARTITION } from '../capabilities/economy/index.ts';
import { DICE_PARTITION } from '../apps/dice/partition.ts';
import { userEconomyHarness } from './user-economy-harness.js';

// Keep the production module, controller and message cleanup. Replace native I/O and inactive UI workers.
const compiled = await build({
    stdin: { contents: `export { createProductionDiceModule } from '../apps/dice/production-module.ts'; export { host } from 'dice-cleanup-host';`,
        resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    footer: { js: '//# sourceURL=dice-lifecycle-fixture.js' },
    plugins: [{ name: 'dice-cleanup-host', setup(builder) {
        builder.onResolve({ filter: /^js-sha256$/ }, () => ({ path: import.meta.resolve('js-sha256'), external: true }));
        builder.onResolve({ filter: /(?:^dice-cleanup-host$|\/(?:script|group-chats|sillytavern-port|sillytavern-chat-save|generation-adapter|message-display|encounter-runtime|encounter-display)\.js$)/ },
            () => ({ path: 'host', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
            export let is_send_press = false;
            export const is_group_generating = false;
            export const host = { source: null, save: null, editing: -1,
                get busy() { return is_send_press; }, set busy(value) { is_send_press = value; },
                get saving() { return isChatSaving; }, set saving(value) { isChatSaving = value; }, cancelled: false };
            export let isChatSaving = false;
            export const captureDiceChat = () => host.source;
            export const ensureDiceDisplayRule = async () => {};
            export const isDiceMessageBeingEdited = index => host.editing === index;
            export const updateMessageBlock = () => {};
            export const saveSillyTavernChat = guard => host.save(guard);
            export const createDiceGenerationAdapter = (_enabled, frequency) => {
                host.frequency = frequency;
                return { start() { host.actionStarted = true; }, stop() { host.actionStarted = false; }, isBusy: () => host.busy, cancel() { host.cancelled = true; } };
            };
            export const createEncounterRuntime = () => ({ start() { host.encounterStarted = true; }, stop() { host.encounterStarted = false; }, cancel() {} });
            export const createEncounterDisplay = () => ({ start() {}, stop() {}, refresh() {} });
            export const createDiceMessageDisplay = (_runtime, enabled) => {
                const refresh = () => { host.displayEnabled = enabled(); };
                return { start: refresh, stop() {}, refresh };
            };
        ` }));
    } }],
});
// eslint-disable-next-line no-unsanitized/method -- Fixed repository code and test I/O fixture only.
const { createProductionDiceModule, host } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

// Exercise the real module registry and global settings: a native welcome
// screen has no binding, which is normal and must not fail the Dice runtime.
for (const startsWithChat of [false, true]) {
    test(`Dice survives ${startsWithChat ? 'leaving a chat' : 'startup before any chat opens'} and keeps global preferences`, async t => {
        let capture = null;
        let writes = 0;
        host.source = null;
        const root = {};
        const settings = createSettingsRepository({ getExtensionSettings: () => root, saveSettings() {} });
        await settings.prepare();
        await settings.setDiceFeature('actionChecksEnabled', true);
        await settings.setDiceFeature('encountersEnabled', true);
        let userDocument = null;
        const kernel = createKernelComposition({
            modules: [createProductionDiceModule(settings, async () => ({world:false,summary:false}), () => false)], capabilities: createEconomyCapabilityRegistrations(),
            user: { storage: { read: async () => userDocument, replace: async (_name, value) => { userDocument = value; } },
                initialPartitions: async () => ({ economy: ECONOMY_PARTITION.createInitial(), dice: DICE_PARTITION.createInitial() }), resolveStory: async () => capture },
            storage: {
                async read() { throw new Error('The binding lifecycle already loaded this file'); },
                async replace() { writes++; throw new Error('Lifecycle must not write preferences'); },
            },
            chatReferences: {
                capture: () => capture,
                isCurrent: requested => requested === capture,
            },
        });
        t.after(() => kernel.dispose());
        async function selectChat(chatId, enabled) {
            const binding = { kind: 'character', ownerLocator: 'mira.png', chatId };
            capture = { identityKey: `character:mira.png:${chatId}`, binding, reference: { formatVersion: 1, osId: chatId } };
            host.source = { key: capture.identityKey, chat: [] };
            kernel.transactions.invalidateCurrent();
            // Same boundary used by production's chat binding lifecycle.
            await kernel.transactions.installResolvedEnvelope({
                formatVersion: 1, osId: chatId, binding, revision: 1, commitId: `commit_${chatId}`,
                partitions: { dice: { schemaVersion: 1, actionChecksEnabled: enabled, encountersEnabled: false } },
            });
        }
        if (startsWithChat) { await selectChat('chat-a', true); }
        await kernel.install();
        await kernel.apps.startBackground();
        assert.equal(kernel.apps.status('dice').state, 'ready');
        assert.equal(host.frequency(), 'standard');
        await settings.setDiceActionCheckFrequency('active');
        assert.equal(host.frequency(), 'active', 'production generation reads current global frequency without reinstalling');

        if (!startsWithChat) { await selectChat('chat-a', true); }
        await kernel.apps.handleChatChanged();
        assert.equal(host.displayEnabled, true, 'The display uses global preferences without reopening Dice');
        assert.equal(kernel.apps.status('dice').state, 'ready');
        let state = await kernel.apps.activate('dice', { isCurrent: () => true, post() {} });
        assert.equal(state.actionChecksEnabled, true);

        capture = null; host.source = null;
        kernel.transactions.invalidateCurrent();
        await kernel.apps.handleChatChanged();
        assert.equal(kernel.apps.status('dice').state, 'ready');

        await selectChat('chat-b', false);
        await kernel.apps.handleChatChanged();
        state = await kernel.apps.activate('dice', { isCurrent: () => true, post() {} });
        assert.equal(state.chatIdentity, 'character:mira.png:chat-b');
        assert.equal(state.actionChecksEnabled, true, 'Old chat-local preferences cannot override the global switch');
        assert.equal(state.encountersEnabled, true);
        assert.equal(state.actionCheckFrequency, 'active');
        assert.equal(writes, 0);
    });
}

test('chat cleanup disables Dice and saves its message cleanup without deleting the paid global sheet', async () => {
    for (const mode of ['confirmed', 'unconfirmed', 'switched', 'busy']) {
        const userMessage = { is_user: true, mes: 'User prose', extra: { foreign: 1, xiaobaiOsDice: { schemaVersion: 1, encounter: { outcome: 'medium' } } } };
        const message = { mes: 'Narrative', extra: { xiaobaiOsDice: { checks: [] }, other: 'retained' },
            swipes: ['Old', 'Narrative'], swipe_info: [{ extra: { xiaobaiOsDice: {}, reasoning: 'old' } }, { extra: { xiaobaiOsDice: {} } }] };
        host.source = { key: 'chat-a', chat: [userMessage, message] }; host.busy = mode === 'busy'; host.cancelled = false;
        const root = {};
        let persist = () => {};
        const settings = createSettingsRepository({ getExtensionSettings: () => root, saveSettings: () => persist() });
        await settings.prepare();
        await settings.setDiceFeature('actionChecksEnabled', true);
        await settings.setDiceFeature('encountersEnabled', true);
        let writes = 0;
        let removed = false;
        persist = () => {
            assert.ok(message.extra.xiaobaiOsDice, 'message data remains while disabling preferences');
            assert.ok(userMessage.extra.xiaobaiOsDice);
            assert.equal(writes, 0);
        };
        const saving = Promise.withResolvers();
        const confirmation = Promise.withResolvers();
        const module = createProductionDiceModule(settings, async () => ({world:false,summary:false}), () => false);
        const wallet = await userEconomyHarness();
        await module.install({ execution: { addCleanup() {} }, partition: wallet.store(DICE_PARTITION), files: wallet.transactions });
        host.save = async guard => {
            saving.resolve();
            writes++;
            assert.equal(guard(), true);
            assert.equal(settings.read().apps.dice.actionChecksEnabled, false);
            assert.equal(settings.read().apps.dice.encountersEnabled, false);
            assert.equal(host.cancelled, true);
            assert.equal(message.extra.xiaobaiOsDice, undefined);
            assert.equal(userMessage.extra.xiaobaiOsDice, undefined);
            return confirmation.promise;
        };
        const operation = module.clearData({ async removePartition(key) {
            removed = true; assert.fail(`Chat cleanup must not remove user partition ${key}`);
        } });
        const result = operation.then(() => null, error => error);
        if (mode !== 'busy') {
            await saving.promise;
            assert.equal(writes, 1);
            assert.equal(removed, false, 'partition removal must wait for the cleanup save acknowledgement');
            if (mode === 'switched') { host.source = { key: 'chat-b', chat: [] }; }
            confirmation.resolve({ status: mode === 'unconfirmed' ? 'unconfirmed' : 'confirmed' });
        }
        const error = await result;
        assert.equal(writes, mode === 'busy' ? 0 : 1);
        assert.equal(removed, false);
        assert.equal(Boolean(error), mode !== 'confirmed');
        assert.equal(message.mes, 'Narrative');
        assert.equal(userMessage.mes, 'User prose');
        assert.equal(userMessage.extra.foreign, 1);
        assert.deepEqual(message.swipes, ['Old', 'Narrative']);
        assert.equal(message.extra.other, 'retained');
        assert.equal(message.swipe_info[0].extra.reasoning, 'old');
        if (mode === 'busy') {
            assert.equal(host.cancelled, false);
            assert.equal(settings.read().apps.dice.actionChecksEnabled, true);
            assert.equal(settings.read().apps.dice.encountersEnabled, true);
            assert.ok(message.extra.xiaobaiOsDice);
            assert.ok(userMessage.extra.xiaobaiOsDice);
            assert.ok(message.swipe_info.every(info => Object.hasOwn(info.extra, 'xiaobaiOsDice')));
        } else { assert.ok(message.swipe_info.every(info => !Object.hasOwn(info.extra, 'xiaobaiOsDice'))); }
    }
});
