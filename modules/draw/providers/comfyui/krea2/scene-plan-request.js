// [K2] Krea2 方案的请求组装：原件 buildScenePlannerRequest 是 shared/scene-planner.js 的内部函数
// （连同 buildNativeWorldInfoForDraw / combineWorldInfoEntries / buildSessionLimitsLine 都不导出），
// 且原件的 tool 与 frame 是写死的内部依赖，没有替换缝——所以这里照搬它的组装顺序，
// 只把 tool 与 frame 换成 krea2/ 下自己的版本。其余每一步都复用 shared 的原实现。
// 与原件差异：不调用 emitScenePromptReady（仅影响提示词预览事件），tool/frame 取自 krea2/。
import { buildCharacterInfoForLLM, getEffectivePromptConfig, getEffectiveTagGuide } from '../../../shared/scene-planner.js';
import { normalizeScenePlannerProfile } from '../../../shared/scene-planner-profile.js';
import {
    applyPromptSlots,
    createPromptSlots,
    expandScenePromptText,
    loadScenePromptRuntime,
} from '../../../shared/scene-prompt-expansion.js';
import { stripScenePointMarkers } from '../../../shared/scene-source.js';
import { buildScenePlannerSystemPrompt, buildScenePlannerUserTask } from './scene-planner-frame.js';
import { createSubmitScenePlanTool } from './scene-plan-tool.js';

// 照抄原件 buildNativeWorldInfoForDraw + collectWorldInfoSections + combineWorldInfoEntries
// （三者均为 scene-planner.js 的内部函数）。
async function buildWorldInfoText({ useWorldInfo, worldbookEntries, scanText, presentCharacters }) {
    let nativeEntries = '';
    if (useWorldInfo) {
        try {
            const { getWorldInfoPrompt } = await import('../../../../../../../../../scripts/world-info.js');
            const charNames = (presentCharacters || []).map((item) => item?.name).filter(Boolean).join(' ');
            const scanChat = [scanText, charNames].map((value) => String(value || '').trim()).filter(Boolean);
            if (scanChat.length) {
                const result = await getWorldInfoPrompt(scanChat, 8192, true, { trigger: 'normal' });
                const sections = [];
                const push = (title, text) => {
                    const content = String(text || '').trim();
                    if (content) sections.push(`【${title}】\n${content}`);
                };
                push('酒馆世界书-前置', result?.worldInfoBefore);
                if (Array.isArray(result?.worldInfoDepth)) {
                    push('酒馆世界书-深度', result.worldInfoDepth
                        .flatMap((item) => (Array.isArray(item?.entries) ? item.entries : []))
                        .map((entry) => String(entry || '').trim())
                        .filter(Boolean)
                        .join('\n'));
                }
                push('酒馆世界书-后置', result?.worldInfoAfter);
                nativeEntries = sections.join('\n\n').trim();
            }
        } catch (error) {
            console.warn('[Draw Scene Planner] 酒馆世界书扫描失败:', error);
        }
    }
    const uploaded = String(worldbookEntries || '').trim();
    const sections = [];
    if (nativeEntries) sections.push(`### 酒馆当前世界书\n${nativeEntries}`);
    if (uploaded) sections.push(`### 画图上传世界书\n${uploaded}`);
    return sections.join('\n\n').trim();
}

export async function buildKrea2Request(plannerOptions) {
    const {
        sceneSource,
        presentCharacters,
        useWorldInfo,
        customPrompts,
        promptDefaults,
        worldbookEntries,
        modelGuide = null,
        maxCharactersPerImage = 0,
    } = plannerOptions;
    const profile = normalizeScenePlannerProfile(plannerOptions.plannerProfile);
    const insertPointCount = Array.isArray(sceneSource.points) ? sceneSource.points.length : 0;
    const promptConfig = getEffectivePromptConfig(customPrompts, promptDefaults);
    const runtime = await loadScenePromptRuntime();
    const slots = createPromptSlots(['worldInfo', 'characterInfo', 'lastMessage']);

    const expandedMessageText = await expandScenePromptText(sceneSource.numberedContent, runtime);
    const scanText = stripScenePointMarkers(expandedMessageText);
    const worldInfoValue = await expandScenePromptText(
        await buildWorldInfoText({
            useWorldInfo,
            worldbookEntries,
            scanText,
            presentCharacters,
        }),
        runtime,
    );
    const characterInfoValue = await expandScenePromptText(
        buildCharacterInfoForLLM(presentCharacters),
        runtime,
    );
    const tagGuide = typeof modelGuide === 'string'
        ? modelGuide
        : getEffectiveTagGuide(promptConfig.tagGuideContent);

    const systemTemplate = buildScenePlannerSystemPrompt({
        opening: promptConfig.topSystem,
        guide: tagGuide,
        sceneRules: promptConfig.sceneRules,
        profile,
    });
    // 数量措辞照抄原件 buildSessionLimitsLine（characters 那一条随 characters 字段一并退场）：
    // maxImages 存在时是"恰好"，否则给 maxPlanImages 的"最多"——与 krea2/scene-plan-contract.js 的
    // 校验语义一致（maxImages 时 images.length !== maxImages 即 failSchema），措辞错一半就白烧一轮纠错。
    const limitsClauses = [];
    if (insertPointCount > 0) limitsClauses.push(`本次正文共有 ${insertPointCount} 个可用插图点，编号范围为 1～${insertPointCount}`);
    const imageLimit = Number(plannerOptions.maxImages) > 0 ? Math.floor(Number(plannerOptions.maxImages)) : 0;
    if (imageLimit) limitsClauses.push(`images 必须恰好包含 ${imageLimit} 项`);
    else if (Number(plannerOptions.maxPlanImages) > 0) limitsClauses.push(`images 最多包含 ${plannerOptions.maxPlanImages} 项`);
    const limitsLine = limitsClauses.length ? `本次提交数量约束：${limitsClauses.join('；')}。` : '';
    const userTaskTemplate = buildScenePlannerUserTask({
        worldInfoSlot: slots.worldInfo,
        characterInfoSlot: slots.characterInfo,
        lastMessageSlot: slots.lastMessage,
        limitsLine,
    });

    const systemPrompt = (await expandScenePromptText(systemTemplate, runtime)).trim();
    const userTask = applyPromptSlots(
        await expandScenePromptText(userTaskTemplate, runtime),
        {
            [slots.worldInfo]: worldInfoValue,
            [slots.characterInfo]: characterInfoValue,
            [slots.lastMessage]: expandedMessageText,
        },
    ).trim();

    return {
        systemPrompt,
        messages: [{ role: 'user', content: userTask }],
        tool: createSubmitScenePlanTool({
            maxImages: plannerOptions.maxImages,
            maxPlanImages: plannerOptions.maxPlanImages,
            maxCharactersPerImage,
            insertPointCount,
            profile,
        }),
    };
}
