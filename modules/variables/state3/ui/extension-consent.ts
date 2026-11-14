import { EXTENSION_COPY as C } from '../extensions/copy.js';

export function requestExtensionConsent(name: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted();
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'lwb-state3-dialog lwb-state3-consent';
        dialog.setAttribute('aria-label', C.trustTitle);
        const title = document.createElement('h2'), text = document.createElement('p'), actions = document.createElement('div');
        title.textContent = C.trustTitle; text.textContent = C.trustConfirm(name); actions.className = 'lwb-state3-actions';
        const finish = (accepted: boolean) => { signal?.removeEventListener('abort', abort); dialog.remove(); resolve(accepted); };
        const abort = () => finish(false);
        for (const [label, accepted] of [[C.allow, true], [C.notNow, false]] as const) {
            const button = document.createElement('button'); button.className = 'menu_button'; button.textContent = label;
            button.addEventListener('click', () => finish(accepted)); actions.append(button);
        }
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        signal?.addEventListener('abort', abort, { once: true });
        dialog.append(title, text, actions); document.body.append(dialog); dialog.showModal();
    });
}
