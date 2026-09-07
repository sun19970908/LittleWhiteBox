import { getRequestHeaders } from '../../../../../../../../script.js';
import { extensionFolderPath } from '../../../../core/constants.js';

type UnknownRecord = Record<string, unknown>;

export interface XiaobaiOsAgentBridge {
    configureXiaobaiOsAgent?: (options: {
        requestHeadersProvider?: (() => Record<string, string>) | null;
    }) => void;
    runXiaobaiOsAgent: (request: UnknownRecord) => Promise<UnknownRecord>;
    openXiaobaiOsAgentSession: (providerConfig: UnknownRecord) => {
        readonly supportsSessionToolLoop: boolean;
        run: (request: UnknownRecord) => Promise<UnknownRecord>;
    };
    pullXiaobaiOsAgentModels: (
        providerConfig: UnknownRecord,
        options?: { signal?: AbortSignal },
    ) => Promise<string[]>;
    testXiaobaiOsAgentConnection: (
        providerConfig: UnknownRecord,
        options?: { signal?: AbortSignal },
    ) => Promise<{ provider: string; model: string; latencyMs: number }>;
}

let bridgePromise: Promise<XiaobaiOsAgentBridge> | null = null;

function toRootedBrowserPath(path: unknown): string {
    const value = String(path || '');
    if (
        /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(value)
        || value.startsWith('/')
        || value.startsWith('./')
        || value.startsWith('../')
    ) {
        return value;
    }
    return `/${value}`;
}

export function loadXiaobaiOsAgentBridge(): Promise<XiaobaiOsAgentBridge> {
    if (!bridgePromise) {
        const source = toRootedBrowserPath(
            `${extensionFolderPath}/modules/xiaobai-os/dist/xiaobai-os-agent.js`,
        );
        // The URL points to this extension's own Vite bundle.
        // eslint-disable-next-line no-unsanitized/method
        bridgePromise = import(source)
            .then((bridge: XiaobaiOsAgentBridge) => {
                bridge.configureXiaobaiOsAgent?.({
                    requestHeadersProvider: () => getRequestHeaders?.() || {},
                });
                return bridge;
            })
            .catch((error) => {
                bridgePromise = null;
                throw error;
            });
    }
    return bridgePromise;
}
