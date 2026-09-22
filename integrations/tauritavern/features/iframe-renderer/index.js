import { extension_settings, getContext } from '../../../../../../../extensions.js';
import { eventSource, event_types, updateMessageBlock } from '../../../../../../../../script.js';
import { EXT_ID } from '../../../../core/constants.js';
import {
    mountLeasedIframeRuntime,
    shouldRenderCodeBlock,
} from '../../../../modules/iframe-renderer.js';
import { claimIframeRuntimes, isMessageInRenderWindow } from './runtime-claims.js';

export function prepareTauriTavernIframeRuntimes({ content, mesid }, claims) {
    const settings = extension_settings[EXT_ID] || {};
    claimIframeRuntimes({
        content,
        claims,
        settings,
        shouldRender: shouldRenderCodeBlock,
        mountRuntime: mountLeasedIframeRuntime,
        mesid,
        chatLength: getContext().chat.length,
    });
}

export function configureTauriTavernIframeRenderer(environment) {
    if (!environment.managed) return;
    // New business messages advance the configured rendering window. A DOM
    // remount is not such an event; it already evaluates admission above.
    const trim = () => {
        const settings = extension_settings[EXT_ID] || {};
        const chat = getContext().chat;
        for (const element of document.querySelectorAll('#chat > .mes')) {
            const mesid = Number(element.getAttribute('mesid'));
            if (isMessageInRenderWindow(settings, mesid, chat.length)) continue;
            if (chat[mesid] && !element.querySelector('.edit_textarea') && element.querySelector('.xiaobaix-iframe-wrapper')) {
                updateMessageBlock(mesid, chat[mesid]);
            }
        }
    };
    eventSource.on(event_types.MESSAGE_RECEIVED, trim);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, trim);
}
