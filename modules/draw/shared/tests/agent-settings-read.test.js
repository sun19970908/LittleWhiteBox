import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

// Acceptance (wrong model/credentials, paid requests): before the first v2 save,
// drawing must use the selected v1 preset through the shared read boundary;
// missing selections and failed reads must never silently choose another model.
test('drawing cold reads upgrade saved presets without writes or replacement identities', async t => {
    const original = JSON.parse(await readFile(new URL('../../../agent-core/tests/fixtures/agent-settings-v1.json', import.meta.url), 'utf8'));
    let disk = structuredClone(original), failedRead = false;
    globalThis.__drawSettingsReadFixture = {
        getStrict: async () => {
            if (failedRead) throw new Error('offline');
            return structuredClone(disk);
        },
        // The former direct read bypassed migration.
        get: async () => structuredClone(disk),
        setAndSave: () => { throw new Error('Read attempted to write'); },
    };
    const hooks = registerHooks({ load(url, context, next) {
        if (url.endsWith('/core/server-storage.js')) return { format: 'module', shortCircuit: true,
            source: 'export const AssistantStorage = globalThis.__drawSettingsReadFixture;' };
        return next(url, context);
    } });
    t.after(() => { hooks.deregister(); delete globalThis.__drawSettingsReadFixture; });
    const { resolveDrawAgentProviderConfig } = await import('../draw-agent.js');
    const selected = original.presets[original.currentPresetName];
    const active = selected.modelConfigs[selected.provider];
    const result = await resolveDrawAgentProviderConfig();
    for (const field of ['model', 'baseUrl', 'apiKey']) assert.equal(result.providerConfig[field], active[field]);
    assert.deepEqual(disk, original);
    disk.currentPresetName = 'deleted-preset';
    await assert.rejects(resolveDrawAgentProviderConfig(), { code: 'AGENT_PRESET_INVALID' });
    failedRead = true;
    await assert.rejects(resolveDrawAgentProviderConfig(), { code: 'AGENT_SETTINGS_LOAD_FAILED' });
});
