// SDK compatibility belongs here, never in saved presets or individual Agent apps.
const OPENAI_NO_AUTH_PLACEHOLDER = 'agent-core-no-auth';
// Keep the existing Messages wire version when upgrading the SDK.
const ANTHROPIC_API_VERSION = '2023-06-01';

export function normalizeAgentApiKey(value) {
    return String(value ?? '').trim();
}

export function resolveAgentAuth(provider, value) {
    const apiKey = normalizeAgentApiKey(value);
    if (provider === 'google') {
        // @google/genai accepts an explicitly empty header in browser and Node.
        // Remove this override when the SDK exposes a credential-free Gemini mode.
        const headers = { 'x-goog-api-key': apiKey };
        return { apiKey, headers, sdkOptions: { apiKey, vertexai: false } };
    }
    if (provider === 'anthropic') {
        const headers = apiKey ? { 'x-api-key': apiKey } : {};
        const requestHeaders = {
            'Content-Type': 'application/json', Accept: 'application/json',
            'anthropic-version': ANTHROPIC_API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true',
            ...headers,
        };
        return {
            apiKey,
            headers,
            sdkOptions: {
                apiKey,
                authToken: null,
                // SDK 1.x switched API keys to Bearer. Preserve the documented
                // x-api-key protocol used by existing native Anthropic relays.
                // Remove this override if that upstream header is retired.
                defaultHeaders: { ...requestHeaders, 'X-Api-Key': apiKey || null, Authorization: null },
                // SDK 1.x also imports arbitrary ANTHROPIC_CUSTOM_HEADERS from
                // the environment. Only this preset may supply request identity.
                fetch: (input, options) => globalThis.fetch(input, { ...options, headers: requestHeaders }),
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
            // OpenAI SDK requires a nonempty constructor credential even when the
            // Authorization header is explicitly omitted. Never send this sentinel.
            // Remove it when the SDK supports credential-free construction.
            apiKey: apiKey || OPENAI_NO_AUTH_PLACEHOLDER,
            adminAPIKey: null,
            defaultHeaders: { Authorization: null, 'api-key': null, ...requestHeaders },
            // OpenAI SDK merges OPENAI_CUSTOM_HEADERS into SDK defaults. These
            // JSON-only Agent endpoints use CORE-owned headers, not ambient SDK
            // headers (which can contain credentials under arbitrary names).
            // Override Content-Type above before SDK encoding; isolate all headers
            // at its public fetch boundary without changing process-wide state.
            fetch: (input, options) => globalThis.fetch(input, { ...options, headers: requestHeaders }),
        },
    };
}
