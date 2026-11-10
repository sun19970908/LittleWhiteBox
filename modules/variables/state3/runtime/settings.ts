import { extension_settings } from '../../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../../script.js';
import { reject } from '../engine/diagnostics.js';

export interface UpdaterSettings { auto: boolean; source: 'main' | 'delegate' }
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
    const stored = preferences()?.state3Updater;
    return { auto: stored?.auto === true, source: stored?.source ?? 'main' };
}
export function saveSettings(settings: UpdaterSettings) {
    if (typeof settings.auto !== 'boolean' || !['main', 'delegate'].includes(settings.source)) {reject('settings');}
    preferences().state3Updater = { auto: settings.auto, source: settings.source };
    saveSettingsDebounced();
}
