// Existing renderer operations exposed through RunJavaScriptApi, not new tools.
const METHODS = { processMessageById: 'ui' } as const;
interface Manifest {
    allowedPaths?: string[];
    callablePaths?: string[];
    apiSemantics?: Record<string, string>;
    namespaces?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
}

export function withIframeRendererJsApiManifest(manifest: Manifest = {}) {
    const paths = Object.keys(METHODS).map(name => 'st.iframeRenderer.' + name);
    const unique = (values: string[]) => [...new Set(values)].sort();
    return {
        ...manifest,
        allowedPaths: unique([...(manifest.allowedPaths || []), 'st', 'st.iframeRenderer', ...paths]),
        callablePaths: unique([...(manifest.callablePaths || []), ...paths]),
        apiSemantics: { ...manifest.apiSemantics, ...Object.fromEntries(Object.entries(METHODS).map(([name, semantic]) => ['st.iframeRenderer.' + name, semantic])) },
        namespaces: { ...manifest.namespaces, st: { ...manifest.namespaces?.st, iframeRenderer: paths } },
    };
}

export function iframeRendererJsApiNamespace(
    processMessageById: (messageId: number, forceFinal?: boolean) => unknown,
    managed: boolean,
) {
    return Object.freeze({
        processMessageById(messageId: number, forceFinal = true) {
            // In managed hosts updateMessageBlock already recreates runtime leases.
            // Starting the ordinary renderer too would create a second owner.
            if (!managed) { return processMessageById(messageId, forceFinal); }
        },
    });
}
