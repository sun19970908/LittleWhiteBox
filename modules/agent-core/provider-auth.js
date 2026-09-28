// SDK compatibility belongs here, never in saved presets or individual Agent apps.
const OPENAI_NO_AUTH_PLACEHOLDER = 'agent-core-no-auth';

export function normalizeAgentApiKey(value) {
    return String(value ?? '').trim();
}

export function resolveAgentAuth(provider, value) {
    const apiKey = normalizeAgentApiKey(value);
    if (provider === 'google') {
        // @google/genai 1.x accepts an explicitly empty header in browser and Node.
        // Remove this override when the SDK exposes a credential-free Gemini mode.
        const headers = { 'x-goog-api-key': apiKey };
        return { apiKey, headers, sdkOptions: { apiKey, vertexai: false } };
    }
    if (provider === 'anthropic') {
        const headers = apiKey ? { 'x-api-key': apiKey } : {};
        return {
            apiKey,
            headers,
            sdkOptions: {
                apiKey,
                authToken: null,
                ...(!apiKey ? { defaultHeaders: { 'X-Api-Key': null, Authorization: null } } : {}),
            },
        };
    }
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const requestHeaders = { 'Content-Type': 'application/json', Accept: 'application/json', ...headers };
    return {
        apiKey,
        headers,
        requestHeaders,
        sdkOptions: {
            // OpenAI 6.x requires a nonempty constructor credential even when the
            // Authorization header is explicitly omitted. Never send this sentinel.
            // Remove it when the SDK supports credential-free construction.
            apiKey: apiKey || OPENAI_NO_AUTH_PLACEHOLDER,
            adminAPIKey: null,
            defaultHeaders: { Authorization: null, 'api-key': null, ...requestHeaders },
            // OpenAI 6.x merges OPENAI_CUSTOM_HEADERS into SDK defaults. These
            // JSON-only Agent endpoints use CORE-owned headers, not ambient SDK
            // headers (which can contain credentials under arbitrary names).
            // Override Content-Type above before SDK encoding; isolate all headers
            // at its public fetch boundary without changing process-wide state.
            fetch: (input, options) => globalThis.fetch(input, { ...options, headers: requestHeaders }),
        },
    };
}
