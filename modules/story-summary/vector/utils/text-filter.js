// ═══════════════════════════════════════════════════════════════════════════
// Text Filter - 通用文本过滤
// 跳过用户定义的「起始→结束」区间 + 本地扩展的内置占位符规则
// ═══════════════════════════════════════════════════════════════════════════

import { getTextFilterRules } from '../../data/config.js';
import { stripMarkupTags } from './markup-text.js';
import { projectMessageProse } from './message-prose.js';

import { applyTextFilterRules } from '../../data/text-filter-rules.js';
export { applyTextFilterRules } from '../../data/text-filter-rules.js';

// 本地扩展：内置占位符过滤规则（顺序：插图 → TTS → state），硬编码、无开关、
// 无配置项。剥掉这三类占位符，避免污染 L1 chunk 与 L2 生成入参。
// 插图一条与 draw/shared/scene-source.js 的 IMAGE_MARKER_REGEX 保持一致。
// 模块级复用：.replace 对 global 正则会自动重置 lastIndex，无需每次重建。
const BUILTIN_PLACEHOLDER_REGEXES = [
    /\[(?:image|ebook-image|tavern-image)\s*:\s*[^\]]+\]/gi,
    /\[tts:[^\]]*\]/gi,
    /<state>[\s\S]*?<\/state>/gi,
];

function stripBuiltinPlaceholders(text) {
    let result = String(text || '');
    for (const re of BUILTIN_PLACEHOLDER_REGEXES) result = result.replace(re, '');
    return result;
}

/**
 * 便捷方法：使用当前配置过滤文本
 * 顺序：先按内置规则剥占位符，再跑用户的 start→end 区间规则。
 */
export function filterText(text) {
    return applyTextFilterRules(stripBuiltinPlaceholders(text), getTextFilterRules());
}

// Queries and new L1 chunks share the same prose projection. Remove excluded
// blocks before stripping their delimiters; otherwise their contents would leak.
export function cleanRecallMessageText(text) {
    const filtered = filterText(text).replace(/<state>[\s\S]*?<\/state>/gi, '');
    return stripMarkupTags(projectMessageProse(filtered)).trim();
}
