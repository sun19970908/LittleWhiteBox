import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { COPY } from './copy.js';

const DEFAULTS = Object.freeze({ auto: false, source: 'main' });

function validate(value) {
    if (typeof value?.auto !== 'boolean' || !Object.hasOwn(COPY.sources, value?.source)) throw new Error(COPY.settingsInvalid);
    return { auto: value.auto, source: value.source };
}

export function readSettings() {
    const { auto, source } = extension_settings.LittleWhiteBox?.variableUpdater ?? DEFAULTS;
    return { auto: auto === true, source };
}

export function saveSettings(value) {
    extension_settings.LittleWhiteBox.variableUpdater = validate(value);
    saveSettingsDebounced();
}
