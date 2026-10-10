// [K2] Krea2 方案总开关的持久化：写进酒馆扩展设置，跟随 settings.json 保存，重启不丢。
// 键：extension_settings.LittleWhiteBox.draw.krea2Enabled（布尔，默认 false = 原生管线）。
// 这一套是小白x二改里开关类补丁的通用写法（见「小白x工作流\剧情总结.txt」§四/§七/§八）：
// 读→展开 extension_settings；写→??= 建层级 + saveSettingsDebounced()。
// 单帧源：comfy-draw.js 与 krea2-plan.js 都只调这里的函数，避免两处各读一套存储。
import { extension_settings } from '../../../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../../../script.js';

const EXT_ID = 'LittleWhiteBox';
const NAMESPACE = 'draw';
const KREA2_ENABLED_KEY = 'krea2Enabled';

export function isKrea2Enabled() {
    const v = extension_settings?.[EXT_ID]?.[NAMESPACE]?.[KREA2_ENABLED_KEY];
    return v === true;
}

export function setKrea2Enabled(enabled) {
    const root = (extension_settings[EXT_ID] ??= {});
    root[NAMESPACE] ??= {};
    root[NAMESPACE][KREA2_ENABLED_KEY] = enabled === true;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return enabled === true;
}

export function toggleKrea2Enabled() {
    return setKrea2Enabled(!isKrea2Enabled());
}
