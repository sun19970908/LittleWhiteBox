// Krea2 方案接线模块：只做三件事——读开关、备材料、把 scene 规划交给 krea2/ 下的实现，最后注册成任务源。
// K2 的全部自有逻辑都在 ./krea2/ 目录里（框架文案、工具、请求组装、校验合同、规划执行），本文件不复制任何原版代码。
// 返回 {tasks, sceneSource} = 接管场景规划（原生规划器跳过）；返回 null = 未接管（空消息/无插图点，
// 原生规划器会跑并抛出它自己的 EMPTY_MESSAGE / NO_INSERT_POINTS）；抛错 = 直接向上抛，不回退。
// 任务形状与原生 buildTasksFromMessage 完全一致，编译/执行/交付对接管来源无感知。
// 开关持久化在 extension_settings.LittleWhiteBox.draw.krea2Enabled（见 ./krea2/setting.js），
// 与 comfy-draw.js 共用同一份读法；由 comfy-draw.js 的任务源缝动态加载，本模块顶层自注册。
// 循环任务/控制台改开关：setKrea2Enabled(bool) / toggleKrea2Enabled()（本文件再导出，方便直接 import 入口模块）。
import { buildComfyScenePlannerOptions, registerDrawTaskSource } from './comfy-draw.js';
import { resolveDrawAgentContext } from '../../shared/draw-agent.js';
import { beginDrawScenePlannerDiagnostic } from '../../shared/draw-agent-runtime.js';
import { toScenePlannerProgress } from '../../shared/draw-common.js';
import { planKrea2Scene } from './krea2/scene-planner.js';
import { isKrea2Enabled } from './krea2/setting.js';

export { isKrea2Enabled, setKrea2Enabled, toggleKrea2Enabled } from './krea2/setting.js';

async function krea2TaskSource(context = {}) {
    if (!isKrea2Enabled()) return null;
    const { message, signal, onStateChange, useWorldbook = true, stripImageMarkers = true } = context;
    if (!message || typeof message.mes !== 'string' || !message.mes.trim()) return null;

    // 材料准备与原生完全一致（场景源/角色出场检测/世界书条目/激活的提示词预设）。
    const { sceneSource, plannerOptions } = await buildComfyScenePlannerOptions({
        message,
        signal,
        useWorldbook,
        stripImageMarkers,
        onStateChange,
    });

    // 无插图点时原生规划器会立即抛 NO_INSERT_POINTS；钩子不接管，避免空跑纠错循环。
    if (!Array.isArray(sceneSource.points) || !sceneSource.points.length) return null;

    const { agentCore, providerConfig } = await resolveDrawAgentContext({ signal });
    // 诊断进度回调与原生一致（comfy-draw.js 的 buildComfyScenePlannerOptions 内同款写法）——
    // onStateChange 由任务源 context 传入，缺失时不回调（beginDrawScenePlannerDiagnostic 默认 null）。
    const onDiagnosticUpdate = typeof onStateChange === 'function'
        ? diagnostic => onStateChange('llm', toScenePlannerProgress(diagnostic))
        : undefined;

    return planKrea2Scene({
        plannerOptions,
        sceneSource,
        agentCore,
        providerConfig,
        signal,
        diagnostic: beginDrawScenePlannerDiagnostic({}, onDiagnosticUpdate),
    });
}

registerDrawTaskSource(krea2TaskSource);
