/**
 * NovelAI V4 / V4.5 emphasis → ComfyUI A1111 (tag:weight) 转换器。
 *
 * ComfyUI 标准 CLIPTextEncode 节点原生支持 (tag:N) 权重语法
 * （见 comfy/text_encoders/sd1_clip.py 的 token_weights 函数），
 * 但不识别 NovelAI 的 `::` 段落 / `{}` `[]` 位置权重，也不支持负权重。
 *
 * 本模块分两层处理：
 *   第一层 parseNovelSections —— 纯段落切分，只识别 `数字::` 与孤立 `::`
 *                            `数字::` 开始一个段落（可隐式接管前一段落）
 *                            孤立 `::` 提前截断当前段落
 *                            字符串末尾自然结束当前段落
 *                            不强求闭合，NAI 4-5 语法容忍
 *   第二层 extractWeightedTokens —— 处理段落内 brace/bracket 位置权重
 *                            brace 字符不进 buffer，每个 tag 记录出现位置的 braceFactor
 *
 * 段落权重 × brace 因子 = 最终权重。weight<0 推 negativeSink（取绝对值保留权重，
 * 因为 negative 槽位里权重越大压制越强）；weight===1 不加括号。
 */

const WEIGHT_STEP = 0.05;

function isAsciiDigit(ch) {
    return ch >= '0' && ch <= '9';
}

/**
 * 从 start 开始匹配一个可选 `-` 后跟数字序列（含一个可选小数点）。
 */
function matchNumberAt(text, start) {
    let i = start;
    let hasDigit = false;
    let hasDot = false;
    if (text[i] === '-') i++;
    while (i < text.length && (isAsciiDigit(text[i]) || text[i] === '.')) {
        if (text[i] === '.') {
            if (hasDot || !hasDigit) break;
            hasDot = true;
        } else {
            hasDigit = true;
        }
        i++;
    }
    if (!hasDigit) return null;
    const value = parseFloat(text.slice(start, i));
    if (!Number.isFinite(value)) return null;
    return { value, end: i };
}

function formatWeight(weight) {
    if (!Number.isFinite(weight)) return String(weight);
    return Number(weight.toFixed(4)).toString();
}

function computeBraceFactor(multiplyCount, divideCount) {
    return 1 + WEIGHT_STEP * multiplyCount - WEIGHT_STEP * divideCount;
}

function cleanTag(s) {
    return s.trim().replace(/^,+|,+$/g, '').trim();
}

/**
 * 剥掉「整体包裹」的权重壳：`(tag:1.4)` → `tag`。
 * 只匹配整体包裹，tag 内部的转义括号 `\(` `\)` 不受影响；不是权重壳则原样返回。
 */
function stripWeightShell(entry) {
    const m = /^\((.*):-?\d+(?:\.\d+)?\)$/s.exec(String(entry).trim());
    return m ? cleanTag(m[1]) : String(entry).trim();
}

/**
 * 第一层：纯段落切分，不做警告判断。
 * 输出：[{ weight, content, isExplicit }]
 *   - weight: 段落权重
 *   - content: 段落内容字符串（未拆 tag）
 *   - isExplicit: 是否由 `数字::` 显式开启（决定最终是否加括号）
 *
 * 边界规则：
 *   - `数字::` 开启新段落（特例：隐式接管前一段落）
 *   - 孤立 `::` 提前截断当前段落（不是必须闭合符）
 *   - 字符串末尾自然结束当前段落
 *   - 第一段前面允许没有 `::`（prompt 自然开头）
 */
export function parseNovelSections(text) {
    const sections = [];
    let i = 0;
    const n = text.length;
    let currentWeight = 1;
    let sectionStart = 0;
    let isExplicit = false;

    function pushSection(endIndex) {
        const content = text.slice(sectionStart, endIndex);
        if (!cleanTag(content)) return;
        sections.push({
            weight: isExplicit ? currentWeight : 1,
            content,
            isExplicit,
        });
    }

    while (i < n) {
        const ch = text[i];
        const ch2 = i + 1 < n ? text[i + 1] : '';

        if (isAsciiDigit(ch) || (ch === '-' && i + 1 < n && isAsciiDigit(text[i + 1]))) {
            const numMatch = matchNumberAt(text, i);
            if (numMatch && text[numMatch.end] === ':' && text[numMatch.end + 1] === ':') {
                pushSection(i);
                currentWeight = numMatch.value;
                sectionStart = numMatch.end + 2;
                isExplicit = true;
                i = numMatch.end + 2;
                continue;
            }
        }

        if (ch === ':' && ch2 === ':') {
            pushSection(i);
            currentWeight = 1;
            sectionStart = i + 2;
            isExplicit = false;
            i += 2;
            continue;
        }

        i++;
    }

    if (sectionStart < n) {
        pushSection(n);
    }

    return sections;
}

/**
 * 第二层：处理段落内 brace/bracket 位置权重。
 * 输出：[{ tag, braceFactor }]
 */
export function extractWeightedTokens(content) {
    const tokens = [];
    let buffer = '';
    let multiplyCount = 0;
    let divideCount = 0;
    let depth = 0;

    function flushBuffer() {
        const t = cleanTag(buffer);
        if (!t) {
            buffer = '';
            return;
        }
        tokens.push({
            tag: t,
            braceFactor: computeBraceFactor(multiplyCount, divideCount),
        });
        buffer = '';
    }

    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '{') {
            multiplyCount++;
            depth++;
            flushBuffer();
            continue;
        }
        if (ch === '}') {
            flushBuffer();
            if (depth > 0) depth--;
            multiplyCount = Math.max(0, multiplyCount - 1);
            continue;
        }
        if (ch === '[') {
            divideCount++;
            depth++;
            flushBuffer();
            continue;
        }
        if (ch === ']') {
            flushBuffer();
            if (depth > 0) depth--;
            divideCount = Math.max(0, divideCount - 1);
            continue;
        }
        if (ch === ',' && depth === 0) {
            flushBuffer();
            continue;
        }
        buffer += ch;
    }
    flushBuffer();

    return tokens;
}

/**
 * 把 NovelAI emphasis 转换为 ComfyUI 兼容语法。
 * @returns {{ positive: string, negativesExtracted: string[] }}
 */
export function convertNovelEmphasisToComfy(text, options = {}) {
    const externalSink = options.negativeSink;
    const useExternalSink = Array.isArray(externalSink);
    const negatives = useExternalSink ? externalSink : [];

    if (typeof text !== 'string' || text.length === 0) {
        return { positive: '', negativesExtracted: negatives };
    }

    const sections = parseNovelSections(text);

    const parts = [];
    for (const section of sections) {
        const tokens = extractWeightedTokens(section.content);
        for (const { tag, braceFactor } of tokens) {
            const weight = section.weight * braceFactor;
            if (weight < 0) {
                // 保留权重：负权重取绝对值送进 negative 槽位。
                // 在 negative 里「权重越大 = 压制越强」，所以 -1.4 的"强烈不要"
                // 对应 (tag:1.4)；绝对值恰为 1 时不加括号，与正面侧 weight===1 一致。
                const strength = Math.abs(weight);
                const entry = strength === 1 ? tag : `(${tag}:${formatWeight(strength)})`;
                // 去重按 tag 名（首次出现的权重胜出），与改动前"同名只留一条"的语义一致
                if (!negatives.some(item => stripWeightShell(item) === tag)) negatives.push(entry);
                continue;
            }
            if (weight === 1 && !section.isExplicit) {
                parts.push(tag);
            } else {
                parts.push(`(${tag}:${formatWeight(weight)})`);
            }
        }
    }

    return {
        positive: parts.join(', '),
        negativesExtracted: negatives,
    };
}
