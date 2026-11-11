// Frozen settings v1: each named preset contained provider + modelConfigs[provider].
// Compatibility owner: saved Assistant settings (including pre-version records).
// Remove when v1 settings files are no longer accepted at the repository boundary.
const V1_CONNECTION_DEFAULTS = Object.freeze({
    'openai-compatible': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', toolMode: 'tagged-json' },
    'openai-responses': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
    'sillytavern-openai-compatible': { baseUrl: '', model: 'gpt-4o-mini', toolMode: 'tagged-json' },
    'sillytavern-claude': { baseUrl: '', model: 'claude-sonnet-4-0' },
    'sillytavern-google': { baseUrl: '', model: 'gemini-2.5-pro' },
    anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-0' },
    google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-pro' },
    'google-vertex': { baseUrl: '', model: 'gemini-3.8-flash' },
});

function upgradePresetV1(preset = {}, fallbackProvider = 'openai-compatible') {
    const { modelConfigs = {}, ...rest } = preset;
    const provider = preset.provider || fallbackProvider;
    const active = modelConfigs[provider] || {};
    return {
        ...rest, provider,
        apiKey: '', temperature: 1, maxTokens: 32000, sendTemperature: true,
        toolMode: 'native', reasoning: {}, sampling: {},
        modelListAuth: ['google', 'sillytavern-google'].includes(provider) ? 'x-goog-api-key' : 'x-api-key',
        ...V1_CONNECTION_DEFAULTS[provider],
        ...active,
        // These are extra fields, not alternative connection/model values.
        vertex: { authMode: 'relay', projectId: '', location: 'global', serviceAccountJson: '', streamFunctionCallArguments: true,
            ...modelConfigs['google-vertex']?.vertex },
    };
}

export function upgradeAgentSettings(value = {}) {
    if (value.configVersion === 2) return value;
    const { modelConfigs, ...rest } = value;
    const name = value.currentPresetName || value.presetName || '默认';
    const presets = value.presets || (modelConfigs ? { [name]: value } : {});
    return {
        ...rest,
        configVersion: 2,
        presets: Object.fromEntries(Object.entries(presets).map(([key, preset]) => [key, upgradePresetV1(preset)])),
        ...(value.delegateConfig?.provider || value.delegateConfig?.modelConfigs
            ? { delegateConfig: upgradePresetV1(value.delegateConfig, presets[value.delegatePresetName || name]?.provider) } : {}),
    };
}
