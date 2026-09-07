import { isTrustedMessage, postToIframe } from '../../../core/iframe-messaging.js';

export const XIAOBAI_OS_FRAME_SOURCE = 'LittleWhiteBox-XiaobaiOS';

export interface XiaobaiOsHostFrameMessage {
    type: string;
    requestId?: string;
    appId?: string;
    activationToken?: string;
    payload?: unknown;
}

export interface XiaobaiOsFrameAppContext {
    appId: string;
    activationToken: string;
}

export interface XiaobaiOsHostFrameBridge {
    post: (
        type: string,
        payload?: unknown,
        requestId?: string,
        app?: XiaobaiOsFrameAppContext,
    ) => boolean;
    isReady: () => boolean;
    dispose: () => void;
}

export interface XiaobaiOsFrameBridgeOptions {
    iframe: HTMLIFrameElement;
    onReady?: (bridge: XiaobaiOsHostFrameBridge) => void | Promise<void>;
    onMessage?: (message: XiaobaiOsHostFrameMessage, bridge: XiaobaiOsHostFrameBridge) => void | Promise<void>;
    windowTarget?: Window;
}

function createMessageId(): string {
    return `xiaobai-os-host-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates the trusted host side of the Xiaobai OS iframe channel.
 *
 */
export function createXiaobaiOsFrameBridge({
    iframe,
    onReady,
    onMessage,
    windowTarget = window,
}: Partial<XiaobaiOsFrameBridgeOptions> = {}): XiaobaiOsHostFrameBridge {
    if (!iframe) {
        throw new TypeError('frame bridge requires an iframe');
    }
    const frame = iframe;
    let ready = false;
    let disposed = false;

    const bridge: XiaobaiOsHostFrameBridge = Object.freeze({
        post(type: string, payload: unknown = {}, requestId = '', app?: XiaobaiOsFrameAppContext) {
            if (disposed || !ready || typeof type !== 'string' || !type) {
                return false;
            }
            return postToIframe(
                frame,
                {
                    type,
                    requestId: String(requestId || (app ? createMessageId() : '')),
                    ...(app ? { appId: app.appId, activationToken: app.activationToken } : {}),
                    payload,
                },
                XIAOBAI_OS_FRAME_SOURCE,
            );
        },
        isReady() {
            return ready && !disposed;
        },
        dispose,
    });

    function handleLoad() {
        ready = false;
    }

    function handleMessage(event: MessageEvent<unknown>) {
        if (disposed || !isTrustedMessage(event, frame, XIAOBAI_OS_FRAME_SOURCE)) {
            return;
        }
        const message = event.data as XiaobaiOsHostFrameMessage | null;
        if (!message || typeof message.type !== 'string') {
            return;
        }
        if (message.type === 'os/frame-ready') {
            ready = true;
            void onReady?.(bridge);
            return;
        }
        if (!ready) {
            return;
        }
        void onMessage?.(message, bridge);
    }

    function dispose() {
        if (disposed) {
            return;
        }
        disposed = true;
        ready = false;
        frame.removeEventListener('load', handleLoad);
        windowTarget.removeEventListener('message', handleMessage);
    }

    frame.addEventListener('load', handleLoad);
    // Origin, contentWindow and protocol source are all checked above.
    // eslint-disable-next-line no-restricted-syntax
    windowTarget.addEventListener('message', handleMessage);
    return bridge;
}
