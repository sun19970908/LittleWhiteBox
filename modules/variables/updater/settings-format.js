import { defaultPreset, PRESET_FIELDS } from './preset.js';
import { COPY } from './copy.js';

export const PRESET_FORMAT = 'lwb-variable-updater-v2';

// Frozen first-prototype defaults, used only at upgrade/import boundaries.
// Remove with v1 import support; custom text is never compared to new defaults.
const V1_DEFAULTS = Object.freeze({
    system: 'You update the state of an ongoing fictional story. The latest passage is already written. Read its context, current variables and update rules, then submit the changes caused by that passage. Earlier passages explain the situation; they are not events to apply again.',
    checklist: '1. Read the passage and its context.\n2. Read the variable definitions, current values and update requirements.\n3. Request approval to submit.\n4. After approval, call write once with the changes for this passage.',
    readContext: 'First, I will read the saved passage and the current situation.',
    readRules: 'I have read the passage. I will now read the variable definitions, current values and update requirements.',
    askApproval: 'The passage and update requirements are clear. Requesting approval to submit the variable changes.',
    approval: 'Approved. Submit this passage’s variable changes through write. An empty ops array records that this passage makes no changes.',
});

export function defaultSettings() {
    return { version: 2, mode: 'manual', source: 'main', preset: defaultPreset() };
}

export function upgradeV1Settings(saved = {}) {
    const current = defaultSettings();
    return { ...current, mode: saved.mode ?? current.mode,
        source: saved.source === 'delegate' ? 'delegate' : 'main',
        preset: Object.fromEntries(PRESET_FIELDS.map(({ key }) => [key,
            typeof saved.preset?.[key] === 'string' && saved.preset[key] !== V1_DEFAULTS[key]
                ? saved.preset[key] : current.preset[key]])) };
}

export function validateSettings(value) {
    if (value.version !== 2 || !Object.hasOwn(COPY.modes, value.mode) || !Object.hasOwn(COPY.sources, value.source)
        || PRESET_FIELDS.some(field => typeof value.preset?.[field.key] !== 'string')) throw new Error(COPY.presetInvalid);
    return { version: 2, mode: value.mode, source: value.source,
        preset: Object.fromEntries(PRESET_FIELDS.map(({ key }) => [key, value.preset[key]])) };
}

export function readPresetFile(data) {
    if (!['lwb-variable-updater-v1', PRESET_FORMAT].includes(data?.format)
        || PRESET_FIELDS.some(field => typeof data.preset?.[field.key] !== 'string')) throw new Error(COPY.presetInvalid);
    const value = data.format === 'lwb-variable-updater-v1' ? upgradeV1Settings({ preset: data.preset })
        : validateSettings({ ...defaultSettings(), preset: data.preset });
    return { preset: value.preset };
}
