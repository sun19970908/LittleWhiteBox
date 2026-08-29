import {
    getTauriTavernChatSurfaceEnvironment,
    isTauriTavernChatSurfaceManaged,
} from './environment.js';
import { prepareTauriTavernIframeRuntimes } from './iframe-runtime.js';
import { createTauriTavernMessageDecorator } from './message-decorators.js';
import { registerTauriTavernChatSurfaceParticipant } from './participant.js';
import { lockTauriTavernChatSurfaceSettings } from './settings-ui.js';

const EXT_ID = 'LittleWhiteBox';
const BLOCK_PARTICIPANT_KEY = 'blockParticipantRegistration';

/**
 * 读取「阻断 participant 注册」开关。默认关闭 = 照常注册。
 *
 * @param {object} [settings] extension_settings.LittleWhiteBox（由调用方传入，本文件不做 import）
 * @returns {boolean} true = 阻断注册（JSR 独占）；false = 照常注册（默认）
 *
 * ⚠️ 本文件处于 LWB 激活链最上游，**禁止添加任何顶层静态 import**：
 *    顶层 import 解析失败会让整个扩展加载失败（表现为小白x完全消失）。
 *    需要外部模块时一律用函数内动态 import()。
 */
export function isParticipantRegistrationBlocked(settings) {
    const v = settings?.chatSurface?.[BLOCK_PARTICIPANT_KEY];
    return v === undefined ? false : v === true;
}

/**
 * 切换「阻断 participant 注册」开关（异步，供循环任务调用）。
 * 动态 import 只在调用时解析，失败也不会拖垮模块加载。
 * @returns {Promise<boolean>} 切换后的状态
 */
export async function toggleParticipantRegistration() {
    const { extension_settings } = await import('../../../../../extensions.js');
    const root = (extension_settings[EXT_ID] ??= {});
    const next = !isParticipantRegistrationBlocked(root);
    root.chatSurface ??= {};
    root.chatSurface[BLOCK_PARTICIPANT_KEY] = next;
    try {
        const { saveSettingsDebounced } = await import('../../../../../script.js');
        if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    } catch (error) {
        console.warn('[LittleWhiteBox] 开关已改但持久化失败（重载后会丢失）:', error);
    }
    return next;
}

export function activateTauriTavernChatSurface({
    settings,
    hasActiveCustomTemplate,
    hasCustomTemplateForMessage,
    isDrawProviderActive,
}) {
    const environment = getTauriTavernChatSurfaceEnvironment();
    if (!environment.managed) return null;

    // 阻断开关（默认关闭 = 照常注册）：打开时才跳过注册，让 JSR 独占渲染
    if (isParticipantRegistrationBlocked(settings)) return null;

    return registerTauriTavernChatSurfaceParticipant({
        environment,
        settings,
        hasActiveCustomTemplate,
        isDrawProviderActive,
        prepareContent: prepareTauriTavernIframeRuntimes,
        didMount: createTauriTavernMessageDecorator({ settings, hasCustomTemplateForMessage }),
    });
}

export {
    isTauriTavernChatSurfaceManaged,
    lockTauriTavernChatSurfaceSettings,
};
