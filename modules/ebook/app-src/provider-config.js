import { normalizeAgentConfig } from '../../agent-core/config.js';
import {
    createAgentAdapter,
    getProviderLabel as getAgentProviderLabel,
    getToolModeLabel,
    resolveActiveProviderConfig,
} from '../../agent-core/provider-config.js';

export function getProviderLabel(provider = '') {
    return getAgentProviderLabel(provider, {
        'sillytavern-openai-compatible': 'SillyTavern 代理',
    });
}

export function normalizeEbookConfig(configValue = {}) {
    return normalizeAgentConfig(configValue || {});
}

export function getActiveProviderConfig(configValue = {}, options = {}) {
    return resolveActiveProviderConfig(configValue, options);
}

export function createAdapter(providerConfig = {}) {
    return createAgentAdapter(providerConfig);
}

export { getToolModeLabel };
