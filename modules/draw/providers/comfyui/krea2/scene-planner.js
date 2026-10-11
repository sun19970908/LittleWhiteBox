// [K2] Krea2 方案的规划执行：调 LLM + 校验 + 纠错循环。
// LLM 调用与纠错循环照搬原版 runtime（callDrawScenePlannerAgentRuntime：≤3 次尝试、错误回喂、
// JSON 修复，与原生规划完全一致），校验经 validateResult 回调进入本目录的 scene-plan-contract.js
// （字段集 = 原生 - interact/uc + other，校验选项与原生 executor 对齐）。任务出参已是原生形状，
// 可直接交给原版编译/执行/交付。
import { ScenePlannerError } from '../../../shared/scene-plan-contract.js';
import { callDrawScenePlannerAgentRuntime } from '../../../shared/draw-agent-runtime.js';
import { normalizeScenePlannerProfile } from '../../../shared/scene-planner-profile.js';
import { parseSubmittedScenePlan } from './scene-plan-contract.js';
import { buildKrea2Request } from './scene-plan-request.js';

export async function planKrea2Scene(options = {}) {
    const { plannerOptions, sceneSource, agentCore, providerConfig, signal, diagnostic } = options;
    const request = await buildKrea2Request(plannerOptions);
    // 与原生 executor 同款（scene-planner-executor.js 的 parseResult）：K2 字段集含 characters，
    // 必须带 presentCharacters——已录入角色按 schema 省略 appear，靠它归一规范名才不会误报缺外貌。
    const centerMode = normalizeScenePlannerProfile(plannerOptions.plannerProfile).centerMode === 'normalized'
        ? 'normalized'
        : 'grid';

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
            presentCharacters: Array.isArray(plannerOptions.presentCharacters) ? plannerOptions.presentCharacters : [],
            maxImages: plannerOptions.maxImages,
            maxPlanImages: plannerOptions.maxPlanImages,
            maxCharactersPerImage: plannerOptions.maxCharactersPerImage,
            centerMode,
            presetName: (validationContext.providerConfig || providerConfig || {}).currentPresetName,
            provider: (validationContext.providerConfig || providerConfig || {}).provider,
            model: (validationContext.providerConfig || providerConfig || {}).model,
        }),
    });

    // [K2] 不再置空 characterPrompts：compiler 只在 task 无该字段时才从 chars 组装角色提示词
    // （compileComfyPromptForTask 的三元分支），chars（真实角色 + other 伪条目）必须走
    // chars → assembleCharacterPrompts 通道；chars 为空时组装结果同为 []，与置空写法等价。
    const tasks = response.parsed?.tasks || [];
    // 开关打开 = 强制 Krea2：拿不到任务就硬失败，不返回 null 让原生规划器顶上。
    if (!tasks.length) {
        throw new ScenePlannerError('Krea2 场景规划没有产出任何图片任务。', 'NO_IMAGE_TASKS');
    }

    console.info(`[Krea2] 已接管场景规划：${tasks.length} 个任务（字段集 = 原生 - interact/uc + other）`);
    return { tasks, sceneSource };
}
