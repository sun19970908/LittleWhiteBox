import { normalizeAgentConfig } from '../../../agent-core/config.js';
import { resolveActiveProviderConfig } from '../../../agent-core/provider-config.js';
import { getProviderLabel } from '../../../agent-core/provider-resolution.js';
import { vertexConfigFields, type normalizeVertexConfig } from '../../../agent-core/vertex-config.js';

export type XbTavernProviderRole = 'main' | 'delegate';
export const TAVERN_DELEGATE_REQUIRED_MESSAGE = '请先配置分身模型。';

export interface XbTavernProviderResolveOptions {
    role?: XbTavernProviderRole;
    timeoutMs?: number;
}

export interface XbTavernReasoningConfig {
    mode: 'inherit' | 'on' | 'off';
    output: 'show' | 'hide';
    effort?: string;
    budgetTokens?: number;
    profileId: string;
    valid: boolean;
    error?: string;
}

export interface XbTavernResolvedProvider {
    currentPresetName: string;
    provider: string;
    providerLabel: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    vertex?: ReturnType<typeof normalizeVertexConfig>;
    temperature: number;
    maxTokens: number | null;
    timeoutMs: number;
    toolMode: string;
    reasoning: XbTavernReasoningConfig;
    readiness: {
        ok: boolean;
        missing: string[];
        message: string;
    };
}

export function getXbTavernProviderLabel(provider = ''): string {
    return getProviderLabel(provider);
}

export function resolveXbTavernProviderConfig(
    agentConfig: Record<string, unknown> = {},
    options: XbTavernProviderResolveOptions = {},
): XbTavernResolvedProvider {
    const role = options.role === 'delegate' ? 'delegate' : 'main';
    const normalizedAgentConfig = normalizeAgentConfig(agentConfig || {});
    if (role === 'delegate' && normalizedAgentConfig.delegateConfigured !== true) {
        return {
            currentPresetName: String(normalizedAgentConfig.delegatePresetName || ''),
            provider: '',
            providerLabel: getXbTavernProviderLabel(''),
            baseUrl: '',
            model: '',
            apiKey: '',
            temperature: 1,
            maxTokens: null,
            timeoutMs: Number(options.timeoutMs) || 15 * 60 * 1000,
            toolMode: 'native',
            reasoning: {
                mode: 'inherit',
                output: 'hide',
                profileId: 'unsupported',
                valid: true,
            },
            readiness: {
                ok: false,
                missing: ['分身模型'],
                message: TAVERN_DELEGATE_REQUIRED_MESSAGE,
            },
        };
    }
    const providerConfig = resolveActiveProviderConfig(normalizedAgentConfig, {
        ...(role === 'delegate' ? { role: 'delegate' as const } : {}),
        timeoutMs: Number(options.timeoutMs) || 15 * 60 * 1000,
    });
    const provider = String(providerConfig.provider || '');
    const model = String(providerConfig.model || '').trim();
    const apiKey = String(providerConfig.apiKey || '').trim();
    const missing: string[] = [];
    if (!model) {missing.push('模型');}
    const message = missing.length
        ? role === 'delegate'
            ? `请先在 API 配置里配置分身模型：缺少 ${missing.join('、')}`
            : `请先在 API 配置里选择模型：缺少 ${missing.join('、')}`
        : 'API 配置可用';
    return {
        currentPresetName: String(providerConfig.currentPresetName || ''),
        provider,
        providerLabel: getXbTavernProviderLabel(provider),
        baseUrl: String(providerConfig.baseUrl || ''),
        model,
        apiKey,
        ...vertexConfigFields(provider, providerConfig.vertex),
        temperature: Number(providerConfig.temperature ?? 1),
        maxTokens: providerConfig.maxTokens === null || providerConfig.maxTokens === undefined
            ? null
            : Number(providerConfig.maxTokens),
        timeoutMs: Number(providerConfig.timeoutMs) || 15 * 60 * 1000,
        toolMode: String(providerConfig.toolMode || 'native'),
        reasoning: providerConfig.reasoning as XbTavernReasoningConfig,
        readiness: {
            ok: missing.length === 0,
            missing,
            message,
        },
    };
}

export function assertXbTavernProviderReady(
    agentConfig: Record<string, unknown> = {},
    options: XbTavernProviderResolveOptions = {},
): XbTavernResolvedProvider {
    const resolved = resolveXbTavernProviderConfig(agentConfig, options);
    if (!resolved.readiness.ok) {
        throw new Error(resolved.readiness.message);
    }
    return resolved;
}
