import { extension_settings } from '../../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../../script.js';
import { reject } from '../engine/diagnostics.js';

export interface UpdaterSettings { mode: 'off' | 'manual' | 'auto'; source: 'main' | 'delegate' }
interface Preferences { variablesMode?: string; state3Updater?: UpdaterSettings }
const preferences = () => (extension_settings as typeof extension_settings & { LittleWhiteBox: Preferences }).LittleWhiteBox;
export const state3Selected = () => preferences()?.variablesMode === '3.0';
export function selectState3() {
    preferences().variablesMode = '3.0';
    const selector = document.getElementById('xiaobaix_variables_mode') as HTMLSelectElement | null;
    if (selector) {selector.value = preferences().variablesMode!;}
    saveSettingsDebounced();
}
export function readSettings(): UpdaterSettings {
    return structuredClone(preferences()?.state3Updater || { mode: 'manual', source: 'main' });
}
export function saveSettings(settings: UpdaterSettings) {
    if (!['off', 'manual', 'auto'].includes(settings.mode) || !['main', 'delegate'].includes(settings.source)) {reject('settings');}
    preferences().state3Updater = { mode: settings.mode, source: settings.source };
    saveSettingsDebounced();
}
