import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { COPY } from './copy.js';

const DEFAULTS = Object.freeze({ mode: 'manual', source: 'main' });

function validate(value) {
    if (!Object.hasOwn(COPY.modes, value?.mode) || !Object.hasOwn(COPY.sources, value?.source)) throw new Error(COPY.settingsInvalid);
    return { mode: value.mode, source: value.source };
}

export function readSettings() {
    const { mode, source } = extension_settings.LittleWhiteBox?.variableUpdater ?? DEFAULTS;
    return { mode, source };
}

export function saveSettings(value) {
    extension_settings.LittleWhiteBox.variableUpdater = validate(value);
    saveSettingsDebounced();
}
