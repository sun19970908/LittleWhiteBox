import { isTauriTavernChatSurfaceManaged } from './environment.js';
import { getManagedLockedControlIds } from './feature-policy.js';
import { TAURITAVERN_MESSAGES } from './diagnostics.js';

export function applyTauriTavernChatSurfaceSettingsLock(root) {
    for (const id of getManagedLockedControlIds()) {
        const element = root.getElementById(id);
        if (!element) continue;
        element.setAttribute('aria-disabled', 'true');
        element.setAttribute('title', TAURITAVERN_MESSAGES.settingsFrozen);
        element.disabled = true;
        element.classList.add('disabled-control');
    }
}

export function lockTauriTavernChatSurfaceSettings(root = document) {
    if (!isTauriTavernChatSurfaceManaged()) return;
    applyTauriTavernChatSurfaceSettingsLock(root);
}
