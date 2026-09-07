// ═══════════════════════════════════════════════════════════════════════════
// Text Filter - 通用文本过滤
// 1) 内置过滤（默认关闭，开关 + 数组驱动）：
//    默认三条（聊天/电纸书/酒馆插图占位符合并为一条 + TTS + state），运行时编译
//    为 RegExp（flags='gi'）。规则数组可由循环任务调用 setBuiltinTextFilters
//    整体覆盖。IMAGE 部分与 draw/shared/scene-source.js 的
//    IMAGE_MARKER_REGEX 保持一致。
// 2) 用户过滤：用户在配置里写的「起始→结束」区间规则。
// ═══════════════════════════════════════════════════════════════════════════

import { extension_settings } from '../../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../../script.js';
import { getTextFilterRules } from '../../data/config.js';

const EXT_ID = "LittleWhiteBox";
const FILTER_BUILTIN_PLACEHOLDERS_KEY = "filterBuiltinPlaceholders";
const BUILTIN_TEXT_FILTERS_KEY = "builtinTextFilters";

// 默认规则：字符串形式（运行时编译为 RegExp，flags='gi'）
// 顺序：先插图 → TTS → state
const DEFAULT_BUILTIN_TEXT_FILTERS = [
    '\\[(?:image|ebook-image|tavern-image)\\s*:\\s*[^\\]]+\\]',
    '\\[tts:[^\\]]*\\]',
    '<state>[\\s\\S]*?</state>',
];

/**
 * 转义正则特殊字符（用户规则用）
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 把字符串数组编译为 RegExp 数组，flags 固定 'gi'。
 * 非法正则跳过，不抛错。
 */
function compileBuiltinFilters(sources) {
    if (!Array.isArray(sources)) return [];
    const out = [];
    for (const source of sources) {
        const s = String(source ?? '').trim();
        if (!s) continue;
        try {
            out.push(new RegExp(s, 'gi'));
        } catch (e) {
            // 非法正则跳过，避免一次坏规则打断整组
        }
    }
    return out;
}

/**
 * 剥离内置占位符：按规则数组逐条 .replace
 */
function applyBuiltinPlaceholderFilters(text) {
    if (!text) return text;
    const regexes = compileBuiltinFilters(getBuiltinTextFilters());
    let result = String(text);
    for (const re of regexes) result = result.replace(re, '');
    return result;
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
 * 顺序：开关开启时先按内置规则数组剥占位符，再跑用户的 start→end 区间规则。
 * 开关关闭时直接走用户规则。
 */
export function filterText(text) {
    const source = isFilterBuiltinPlaceholdersEnabled()
        ? applyBuiltinPlaceholderFilters(text)
        : text;
    return applyTextFilterRules(source, getTextFilterRules());
}

// ── 内置占位符过滤 总开关 ─────────────────────────────────
// 默认关闭：保留占位符原文，避免对 draw / ebook 等模块的副作用；
// 想恢复"过滤 [image:...] 污染"时跑循环任务开启。
export function isFilterBuiltinPlaceholdersEnabled() {
    const v = extension_settings?.[EXT_ID]?.storySummary?.[FILTER_BUILTIN_PLACEHOLDERS_KEY];
    return v === undefined ? false : v === true;
}

export function setFilterBuiltinPlaceholders(flag) {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    root.storySummary[FILTER_BUILTIN_PLACEHOLDERS_KEY] = !!flag;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return isFilterBuiltinPlaceholdersEnabled();
}

export function toggleFilterBuiltinPlaceholders() {
    return setFilterBuiltinPlaceholders(!isFilterBuiltinPlaceholdersEnabled());
}

// ── 内置规则数组 ─────────────────────────────────────────
// 元素为正则源码字符串；运行时统一按 flags='gi' 编译为 RegExp。
// settings 里只存字符串，跨刷新不丢；非法正则会被 compileBuiltinFilters 跳过。
export function getBuiltinTextFilters() {
    const raw = extension_settings?.[EXT_ID]?.storySummary?.[BUILTIN_TEXT_FILTERS_KEY];
    if (Array.isArray(raw)) return raw;
    return [...DEFAULT_BUILTIN_TEXT_FILTERS];
}

export function setBuiltinTextFilters(rules) {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    root.storySummary[BUILTIN_TEXT_FILTERS_KEY] = Array.isArray(rules)
        ? rules.map(r => String(r ?? '').trim()).filter(Boolean)
        : [...DEFAULT_BUILTIN_TEXT_FILTERS];
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return getBuiltinTextFilters();
}
