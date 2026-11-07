import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { defaultSettings, upgradeV1Settings, validateSettings } from './settings-format.js';

export function initializeSettings() {
    const saved = extension_settings.LittleWhiteBox?.variableUpdater;
    if (saved && saved.version !== 2) saveSettings(upgradeV1Settings(saved));
    // Earlier v2 saved a task-level switch. Drop it at the load boundary only.
    else if (saved && Object.hasOwn(saved, 'toolChoice')) saveSettings(saved);
}

export function readSettings() {
    return structuredClone(extension_settings.LittleWhiteBox?.variableUpdater ?? defaultSettings());
}

export function saveSettings(value) {
    extension_settings.LittleWhiteBox.variableUpdater = validateSettings(value);
    saveSettingsDebounced();
}
