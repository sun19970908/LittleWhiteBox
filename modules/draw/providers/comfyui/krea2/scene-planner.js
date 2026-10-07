// [K2] Krea2 方案的规划执行：调 LLM + 校验 + 纠错循环。
// LLM 调用与纠错循环照搬原版 runtime（callDrawScenePlannerAgentRuntime：≤3 次尝试、错误回喂、
// JSON 修复，与原生规划完全一致），校验经 validateResult 回调进入本目录的 scene-plan-contract.js
// （字段不同、逻辑与原始一致）。任务出参已是原生形状，可直接交给原版编译/执行/交付。
import { ScenePlannerError } from '../../../shared/scene-plan-contract.js';
import { callDrawScenePlannerAgentRuntime } from '../../../shared/draw-agent-runtime.js';
import { parseSubmittedScenePlan } from './scene-plan-contract.js';
import { buildKrea2Request } from './scene-plan-request.js';

export async function planKrea2Scene(options = {}) {
    const { plannerOptions, sceneSource, agentCore, providerConfig, signal, diagnostic } = options;
    const request = await buildKrea2Request(plannerOptions);

    const response = await callDrawScenePlannerAgentRuntime({
        task: {
            systemPrompt: request.systemPrompt,
            messages: request.messages,
            tools: [request.tool],
            toolChoice: 'required',
        },
        signal,
        diagnostic,
        agentCore,
        providerConfig,
        validateResult: (result, validationContext = {}) => parseSubmittedScenePlan(result, {
            sceneSource,
            maxImages: plannerOptions.maxImages,
            presetName: (validationContext.providerConfig || providerConfig || {}).currentPresetName,
            provider: (validationContext.providerConfig || providerConfig || {}).provider,
            model: (validationContext.providerConfig || providerConfig || {}).model,
        }),
    });

    const tasks = (response.parsed?.tasks || []).map((task) => ({ ...task, characterPrompts: [] }));
    // 开关打开 = 强制 Krea2：拿不到任务就硬失败，不返回 null 让原生规划器顶上。
    if (!tasks.length) {
        throw new ScenePlannerError('Krea2 场景规划没有产出任何图片任务。', 'NO_IMAGE_TASKS');
    }

    console.info(`[Krea2] 已接管场景规划：${tasks.length} 个任务（scene 为自然语言正向提示词）`);
    return { tasks, sceneSource };
}
