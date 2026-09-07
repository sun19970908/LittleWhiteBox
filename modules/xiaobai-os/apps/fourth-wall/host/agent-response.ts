import type { XiaobaiOsAgentGateway } from '../../../capabilities/agent/gateway.js';
import type { FourthWallBuiltPrompt, FourthWallGenerationResult } from '../types.js';
import type { FourthWallGenerateOptions, FourthWallGenerateResponse } from './generation-runtime.js';

type AgentMessage = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = [
    '你是小白X“四次元壁”的交流生成器。',
    '只完成本轮四次元壁回复，不调用工具，不编造外部事实。',
    '严格遵循后续提示词里的输出格式，优先输出可被解析的 <thinking> 与 <msg> 内容。',
].join('\n');

function buildMessages(
    prompt: Partial<FourthWallBuiltPrompt> = {},
    options: { disableAssistantPrefill?: boolean } = {},
): AgentMessage[] {
    const finalUserPrompt = [
        prompt.msg3 ? String(prompt.msg3).trim() : '',
        options.disableAssistantPrefill && prompt.msg4 ? String(prompt.msg4).trim() : '',
    ].filter(Boolean).join('\n\n');
    return [
        prompt.msg1 ? { role: 'user' as const, content: String(prompt.msg1).trim() } : null,
        prompt.msg2 ? { role: 'assistant' as const, content: String(prompt.msg2).trim() } : null,
        finalUserPrompt ? { role: 'user' as const, content: finalUserPrompt } : null,
        prompt.msg4 && !options.disableAssistantPrefill
            ? { role: 'assistant' as const, content: String(prompt.msg4).trim() }
            : null,
    ].filter((message): message is AgentMessage => message !== null);
}

export function createFourthWallAgentResponse(
    gateway: XiaobaiOsAgentGateway,
): FourthWallGenerateResponse {
    return async (options: FourthWallGenerateOptions): Promise<FourthWallGenerationResult> => {
        const result = await gateway.run({
            config: options.config,
            systemPrompt: SYSTEM_PROMPT,
            messages: buildMessages(options.builtPrompt, {
                disableAssistantPrefill: options.disableAssistantPrefill,
            }),
            tools: [],
            signal: options.signal,
            onStreamProgress: options.stream
                ? (snapshot) => options.onStreamProgress?.(snapshot as FourthWallGenerationResult)
                : undefined,
        });
        return {
            text: String(result.text || ''),
            thoughts: Array.isArray(result.thoughts)
                ? result.thoughts as FourthWallGenerationResult['thoughts']
                : [],
            provider: String(result.provider || ''),
            model: String(result.model || ''),
            finishReason: String(result.finishReason || ''),
        };
    };
}
