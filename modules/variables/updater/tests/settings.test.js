import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { defaultPreset, PRESET_FIELDS } from '../preset.js';
import { defaultSettings, upgradeV1Settings, validateSettings, readPresetFile, PRESET_FORMAT } from '../settings-format.js';

// Data-loss contract: upgrading/importing the prototype preserves author edits;
// removed fields never become part of the current persisted model.
// Fixture: variable-review/default-user settings saved by the first prototype.
const v1 = JSON.parse(readFileSync(new URL('./fixtures/settings-v1.json', import.meta.url), 'utf8'));
test('v1 upgrade and preset import preserve each custom field, not obsolete settings', () => {
    assert.deepEqual(upgradeV1Settings(v1), defaultSettings());
    for (const { key } of PRESET_FIELDS) for (const custom of ['', 'Author-defined content']) {
        const old = structuredClone(v1);
        Object.assign(old, { mode: 'auto', source: 'delegate' });
        old.preset[key] = custom;
        const upgraded = upgradeV1Settings(old);
        assert.deepEqual(upgraded, { ...defaultSettings(), mode: 'auto', source: 'delegate',
            preset: { ...defaultPreset(), [key]: custom } });
        assert.deepEqual(validateSettings(upgraded), upgraded);
        const imported = readPresetFile({ format: 'lwb-variable-updater-v1', preset: old.preset });
        assert.deepEqual(imported, { preset: upgraded.preset });
        for (const toolChoice of ['required', 'auto']) {
            assert.deepEqual(readPresetFile({ format: PRESET_FORMAT, ...imported, toolChoice }), imported);
            assert.deepEqual(validateSettings({ ...upgraded, toolChoice }), upgraded);
        }
    }
});
