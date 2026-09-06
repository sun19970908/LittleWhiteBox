// ═══════════════════════════════════════════════════════════════════════════
// Text Filter - 通用文本过滤
// 1) 内置过滤：避免污染 L1 chunk 与 L2 生成入参。
//    - IMAGE：聊天 [image:slotId] / 电纸书 [ebook-image:slotId] / 酒馆
//      [tavern-image:slotId]，与 modules/draw/shared/scene-source.js 的
//      IMAGE_MARKER_REGEX 保持一致。
//    - TTS：[tts:...] 音频占位符。
//    - STATE：<state>...</state>（L0 已单独存储，不应在原文证据里重复出现）。
// 2) 用户过滤：用户在配置里写的「起始→结束」区间规则。
// ═══════════════════════════════════════════════════════════════════════════

import { getTextFilterRules } from '../../data/config.js';

// 与 draw 模块的 IMAGE_MARKER_REGEX 保持一致。占位符语法变化时同步更新。
const BUILTIN_PLACEHOLDER_REGEX = /\[(?:image|ebook-image|tavern-image)\s*:\s*[a-z0-9_-]+\]/gi;
// TTS 音频占位符：[tts:任意非 ] 内容]
const BUILTIN_TTS_REGEX = /\[tts:[^\]]*\]/gi;
// state 标签：<state>...</state> 跨行、非贪婪
const BUILTIN_STATE_REGEX = /<state>[\s\S]*?<\/state>/gi;

/**
 * 转义正则特殊字符
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 剥离内置占位符。
 * 顺序：先插图占位符 → TTS → state。三者互不重叠，独立处理即可。
 */
function applyBuiltinPlaceholderFilters(text) {
    if (!text) return text;
    return String(text)
        .replace(BUILTIN_PLACEHOLDER_REGEX, '')
        .replace(BUILTIN_TTS_REGEX, '')
        .replace(BUILTIN_STATE_REGEX, '');
}

/**
 * 应用过滤规则
 * - start + end：删除 start...end（含边界）
 * - start 空 + end：从开头删到 end（含）
 * - start + end 空：从 start 删到结尾
 * - 两者都空：跳过
 */
export function applyTextFilterRules(text, rules) {
    if (!text || !rules?.length) return text;

    let result = text;

    for (const rule of rules) {
        const start = rule.start ?? '';
        const end = rule.end ?? '';

        if (!start && !end) continue;

        if (start && end) {
            // 标准区间：删除 start...end（含边界），非贪婪
            const regex = new RegExp(
                escapeRegex(start) + '[\\s\\S]*?' + escapeRegex(end),
                'gi'
            );
            result = result.replace(regex, '');
        } else if (start && !end) {
            // 从 start 到结尾
            const idx = result.toLowerCase().indexOf(start.toLowerCase());
            if (idx !== -1) {
                result = result.slice(0, idx);
            }
        } else if (!start && end) {
            // 从开头到 end（含）
            const idx = result.toLowerCase().indexOf(end.toLowerCase());
            if (idx !== -1) {
                result = result.slice(idx + end.length);
            }
        }
    }

    return result.trim();
}

/**
 * 便捷方法：使用当前配置过滤文本
 * 顺序：先剥内置占位符，再跑用户的 start→end 区间规则。
 */
export function filterText(text) {
    const cleaned = applyBuiltinPlaceholderFilters(text);
    return applyTextFilterRules(cleaned, getTextFilterRules());
}
