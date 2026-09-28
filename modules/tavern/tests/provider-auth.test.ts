import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveXbTavernProviderConfig } from '../app-src/runtime/provider.js';

test('main and explicitly configured delegate models are ready without a key', () => {
    const preset = { provider: 'openai-compatible', modelConfigs: {
        'openai-compatible': { model: 'test-model', baseUrl: 'http://localhost:1234/v1', apiKey: '' },
    } };
    const config = { currentPresetName: 'test', presets: { test: preset }, delegateConfig: preset, delegateConfigured: true };
    for (const role of ['main', 'delegate'] as const) {
        const resolved = resolveXbTavernProviderConfig(config, { role });
        assert.equal(resolved.readiness.ok, true);
        assert.deepEqual(resolved.readiness.missing, []);
        assert.equal(resolved.apiKey, '');
    }
});
