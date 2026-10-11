import { extensionFolderPath } from "../../../../core/constants.js";
import { buildScenePlannerChainPreview, buildScenePlannerFrameText } from '../../shared/scene-planner-frame.js';
import {
    fetchPromptTemplateFiles,
    SHARED_PROMPT_TEMPLATE_FILES,
} from '../../shared/scene-planner-templates.js';

const TAG_GUIDE_PATH = `${extensionFolderPath}/modules/draw/providers/comfyui/COMFY_TAG编写指南.md`;

/** 首次升级安装新版预设；后续内容升级只替换未编辑的默认首段。 */
export const PROMPT_TEMPLATE_VERSION = 11;

/** ComfyUI 的场景规划差异：整图负向、interact 为普通 tag、无坐标字段。 */
export const COMFY_PLANNER_PROFILE = Object.freeze({
    imageModelName: 'ComfyUI',
    centerMode: 'none',
    interactSyntax: 'plain',
    ucScope: 'global',
});


/**
 * 「材料说明与输出去向」的默认文案 = 内置段在 ComfyUI 下的实际文本
 * （${imageModelName} 已解析成 COMFY_PLANNER_PROFILE.imageModelName = 'ComfyUI'，不再留占位符）。
 * 用生成函数取而不用字面量，上游改内置文案时默认值自动跟随。
 */
const COMFY_FRAME_TEXT = buildScenePlannerFrameText(COMFY_PLANNER_PROFILE);

/** 用户可编辑的默认值；内置骨架由 scene-planner-frame.js 生成，不在此列。 */
export const COMFY_SCENE_PROMPTS = {
    topSystem: '',
    topSystemPov: '',
    sceneRules: '',
    tagGuideContent: '',
    // 材料说明与输出去向：默认给一份可见的默认文案（ComfyUI 版）；清空则回退到内置生成文本。
    frameText: COMFY_FRAME_TEXT,
};

let tagGuideContent = '';

export { COMFY_SCENE_PROMPTS as DEFAULT_PROMPT_CONFIG };

export function getEffectiveTagGuide(customGuide) {
    if (typeof customGuide === 'string') return customGuide;
    return tagGuideContent;
}

export function getLoadedTagGuide() {
    return tagGuideContent;
}

/** 请求结构只读预览：system / user / tools 三节。 */
export function getPromptChainPreview(customPrompts) {
    return buildScenePlannerChainPreview({
        profile: COMFY_PLANNER_PROFILE,
        hasTagGuide: !!getEffectiveTagGuide(customPrompts?.tagGuideContent).trim(),
    });
}

export async function loadTagGuide() {
    const { texts, ok } = await fetchPromptTemplateFiles({ guide: TAG_GUIDE_PATH }, '[Comfy-Draw Prompts]');
    if (!ok) return false;
    tagGuideContent = texts.guide;
    COMFY_SCENE_PROMPTS.tagGuideContent = tagGuideContent;
    console.log('[Comfy-Draw Prompts] COMFY_TAG编写指南已加载');
    return true;
}

export async function loadPromptTemplates() {
    const { texts, ok } = await fetchPromptTemplateFiles(SHARED_PROMPT_TEMPLATE_FILES, '[Comfy-Draw Prompts]');
    Object.assign(COMFY_SCENE_PROMPTS, texts);
    if (ok) {
        console.log('[Comfy-Draw Prompts] 提示词模板已加载 (topSystem, topSystemPov, sceneRules)');
    } else {
        console.warn('[Comfy-Draw Prompts] 部分提示词文件加载失败，将使用空默认值');
    }
    return ok;
}
