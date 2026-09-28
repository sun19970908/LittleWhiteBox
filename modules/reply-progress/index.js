import { prepareReplyProgressSettings, REPLY_PROGRESS_SETTINGS } from './settings.js';

export function mountReplyProgressSettings({ anchor, settings, saveSettings, runtime }) {
    const config = prepareReplyProgressSettings(settings);
    const document = anchor.ownerDocument;
    const row = document.createElement('div');
    row.className = 'flex-container alignItemsCenter littlewhitebox-setting-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = REPLY_PROGRESS_SETTINGS.controlId;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = REPLY_PROGRESS_SETTINGS.label;
    row.append(checkbox, label);
    anchor.after(row);

    function syncEnabled() {
        checkbox.checked = config.enabled;
        checkbox.disabled = !settings.enabled;
        checkbox.classList.toggle('disabled-control', checkbox.disabled);
        runtime?.setEnabled(settings.enabled && config.enabled);
    }

    function onChange() {
        if (!settings.enabled) return;
        config.enabled = checkbox.checked;
        saveSettings();
        syncEnabled();
    }

    checkbox.addEventListener('change', onChange);
    syncEnabled();

    return {
        syncEnabled,
        resetDefaults() {
            config.enabled = REPLY_PROGRESS_SETTINGS.defaultEnabled;
            syncEnabled();
            saveSettings();
        },
        destroy() {
            runtime?.destroy();
            checkbox.removeEventListener('change', onChange);
            row.remove();
        },
    };
}
