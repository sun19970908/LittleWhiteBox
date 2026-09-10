/**
 * NovelAI V4 / V4.5 emphasis → ComfyUI A1111 (tag:weight) 转换器。
 *
 * ComfyUI 标准 CLIPTextEncode 节点原生支持 (tag:N) 权重语法
 * （见 comfy/text_encoders/sd1_clip.py 的 token_weights 函数），
 * 但不识别 NovelAI 的 `::` 段落 / `{}` `[]` 位置权重，也不支持负权重。
 *
 * 解析分两层：
 *   第一层 parseNovelSections —— 纯段落切分，只识别 `数字::` 与孤立 `::`
 *                            `数字::` 开始一个段落（可隐式接管前一段落）
 *                            孤立 `::` 提前截断当前段落
 *                            字符串末尾自然结束当前段落
 *                            不强求闭合，NAI 4-5 语法容忍
 *   第二层 extractWeightedTokens —— 处理段落内 brace/bracket 位置权重
 *                            brace 字符不进 buffer，每个 tag 记录出现位置的 braceFactor
 * 段落权重 × brace 因子 = 最终权重。weight===1 不加括号。
 *
 * 「转换」与「分流」是两件事，各由一个函数负责，串起来就是一次完整的提示词处理：
 *
 *   convertNovelEmphasisToComfy(text) → string                 只改语法，不判归属
 *        NAI 的 :: / {} / [] 全部展开成 (tag:N)，负权重就地写成 (tag:-N) 留在串里。
 *        壳必须留着 —— 负号承载的是「方向」，剥了壳方向就丢了。
 *
 *   splitNegativeWeights(normalized) → { positive, negative }   只判归属，不改语法
 *        顶层逗号切分后逐段看：壳内带负号 → negative（摘掉负号、权重转正，因为
 *        negative 槽位里权重越大压制越强）；其余原样留在 positive。
 *        判据只依赖字符串本身，所以 NAI 段落负权重 (-1.4::tag) 与 A1111 负权重
 *        ((tag:-1)) 在转换后是同一个形状，这一步一次覆盖两种写法。
 *
 *   convertPromptPair({ positive, negative }) → { positive, negative }
 *        吃一对吐一对：正面走「转换 + 分流」，负面只走「转换」，最后把分流出的
 *        负权重并进负面。负面框不做分流 —— 判据是「没有负号 = 正面」，拿负面串
 *        去跑会把它的裸 tag 当正面搬走。
 *
 * 顺序不可换：分流必须排在「权重全改 1」之前。剥壳会连负号一起摘掉，之后就再也判
 * 不出归属；这也是当初 (tag:-1) 会被剥成正权重 tag 的根因。
 *
 * 转换之后另有两个互相独立的后置工具，都建立在同一套切分/剥壳语义上：
 *   stripAllWeights    —— 权重全改 1（剥掉所有 (tag:N) / (tag:-N) 外壳）
 *   toNegativeOneTags  —— krea2 负面合流，统一 (tag:-1)
 * 二者与转换本身一样：只改写权重表达式，不增删任何 tag（不去重）。
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
 * 「自带方向的负权重壳」：`(tag:-N)`，N 为正数。组1 是 tag，组2 是权重绝对值。
 * 与 stripWeightShell 的正则差一个 `-`：那个是剥壳用的，这个专门用来认方向。
 */
const NEGATIVE_SHELL = /^\((.*):-(\d+(?:\.\d+)?)\)$/s;

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
 * 第一步 · 转换：把 NovelAI emphasis 改写成 ComfyUI 兼容语法。
 *
 * 只改语法，不判归属 —— 负权重不抽走，就地写成 `(tag:-N)` 留在串里，
 * 归谁由 splitNegativeWeights 决定。
 *
 * 写法约定：`N::` 段落权重不要直接扣在 A1111 负权重壳上（`1.2::girl, (qipao:-1)`）——
 * 段落权重会把壳乘成嵌套形式 `((qipao:-1):1.2)`，分流认不出嵌套壳。用 `::` 截断段落即可。
 *
 * @param {string} text 任意提示词串（可含 NAI 语法，也可是已归一的文本）
 * @returns {string} 形如 `(masterpiece:1.2), 1girl, (watermark:-1.4)`；无内容返回 ''
 */
export function convertNovelEmphasisToComfy(text) {
    if (typeof text !== 'string' || text.length === 0) return '';

    const sections = parseNovelSections(text);

    const parts = [];
    for (const section of sections) {
        const tokens = extractWeightedTokens(section.content);
        for (const { tag, braceFactor } of tokens) {
            const weight = section.weight * braceFactor;
            if (weight < 0) {
                // 负权重就地保留成 (tag:-N)，等分流那一步再摘负号。
                parts.push(`(${tag}:-${formatWeight(Math.abs(weight))})`);
                continue;
            }
            if (weight === 1 && !section.isExplicit) {
                parts.push(tag);
            } else {
                parts.push(`(${tag}:${formatWeight(weight)})`);
            }
        }
    }

    return parts.join(', ');
}

/**
 * 第二步 · 分流：按方向把一条已转换的串切成正面与负面两条。
 *
 * 只判归属，不改语法。逐段看是否有「壳内负号」：
 *   `(tag:-N)` → negative，摘掉负号、权重转正（negative 里权重越大压制越强）；
 *    绝对值恰为 1 时落成裸 tag，与正面侧 weight===1 不加括号的规则一致。
 *   其余（裸 tag、`(tag:1.4)` 这类正权重壳）原样进 positive。
 *
 * 也顺带承担剥壳：这一轮之后就不再需要外层壳了，正面与负面各自拿到干净的表达式。
 *
 * @param {string} normalized convertNovelEmphasisToComfy 的输出
 * @returns {{ positive: string, negative: string }}
 */
export function splitNegativeWeights(normalized) {
    const text = String(normalized || '').trim();
    if (!text) return { positive: '', negative: '' };

    const positive = [];
    const negative = [];
    for (const raw of splitTopLevelTags(text)) {
        const segment = cleanTag(raw);
        if (!segment) continue;
        const m = NEGATIVE_SHELL.exec(segment);
        if (!m) {
            positive.push(segment);
            continue;
        }
        const tag = cleanTag(m[1]);
        const strength = Number(m[2]);
        if (!tag || !Number.isFinite(strength) || strength <= 0) {
            positive.push(segment);
            continue;
        }
        negative.push(strength === 1 ? tag : `(${tag}:${formatWeight(strength)})`);
    }

    return { positive: positive.join(', '), negative: negative.join(', ') };
}

/**
 * 拼接两个非空串（与 shared/character-prompts.js 的 joinTags 同语义）。
 *
 * 刻意不 import joinTags：本模块要保持零依赖，单文件就能脱离 LWB 使用。
 * 改动这里时记得跟 joinTags 对齐 —— 全角逗号/顿号会被归一成半角。
 */
function joinNonEmpty(...parts) {
    return parts
        .filter(Boolean)
        .map(part => String(part).trim().replace(/[，、]/g, ',').replace(/^,+|,+$/g, ''))
        .filter(part => part.length > 0)
        .join(', ');
}

/**
 * 第三步 · 包装：吃一对、吐一对。
 *
 *   正面 → 转换 → 分流
 *   负面 → 转换（只到这一步）
 *   最后的 negative = 转换后的负面 + 分流出的负权重
 *
 * 负面不做分流：分流判据是「没有负号 = 正面」，拿负面串去跑，它里面的裸 tag
 * （bad hands）会被判成正侧搬到正面去。
 *
 * 不含「权重全改 1」与「krea2 合流」两个开关 —— 那是调用方的后置步骤，
 * 都必须排在分流之后。
 *
 * @param {{ positive?: string, negative?: string }} pair
 * @returns {{ positive: string, negative: string }}
 */
export function convertPromptPair({ positive = '', negative = '' } = {}) {
    const positiveConverted = convertNovelEmphasisToComfy(String(positive || '').trim());
    const negativeConverted = convertNovelEmphasisToComfy(String(negative || '').trim());
    const split = splitNegativeWeights(positiveConverted);
    return {
        positive: split.positive,
        negative: joinNonEmpty(negativeConverted, split.negative),
    };
}

/**
 * 按顶层逗号切分（括号计数，避免切坏 `(a, b:1.2)`）。
 * 反斜杠转义的字符（A1111 的 `\(` `\)`）连同下一个字符原样带过，不参与计数。
 */
function splitTopLevelTags(text) {
    const out = [];
    let buffer = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\\') {
            buffer += ch;
            if (i + 1 < text.length) buffer += text[++i];
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) {
            out.push(buffer);
            buffer = '';
            continue;
        }
        buffer += ch;
    }
    out.push(buffer);
    return out;
}

/**
 * 把已归一的提示词切成「裸 tag」列表：顶层逗号切分 → 剥掉整体包裹的权重壳。
 *
 * 保持原顺序、原样保留重复，**不做任何去重**——切分只认顶层逗号，
 * 内容一字不改；去重与否交给下游（工作流自身）决定。
 * `toNegativeOneTags` 与 `stripAllWeights` 共用，保证两者切分语义完全一致。
 */
function collectBareTags(normalized) {
    return splitTopLevelTags(normalized)
        .map(raw => stripWeightShell(cleanTag(raw)))
        .filter(Boolean);
}

/**
 * 后置工具 · 权重全改 1：剥掉提示词里所有 `(tag:N)` / `(tag:-N)` 外壳，只留裸 tag。
 *
 * 位置在「转换 + 分流」之后（convertPromptPair）—— 此时 NAI 的 `::` / `{}` / `[]`
 * 已全部展开成 `(tag:N)`，归属也已分好。本函数只看传进来的那一条串，不关心它是
 * 正面还是负面，也不参与判归属：调用方把分好归属的 `positive` / `negative` 各传
 * 一次即可。**必须在分流之后**，提前剥壳会连负号一起摘掉，tag 就分不出方向了。
 *
 * 不去重：输出顺序与输入一致，重复 tag 各保留一条。
 * 幂等：`tag, (a:1.2)` 再跑一次仍是 `tag, a`。
 *
 * @param {string} normalizedText 已转换文本（convertNovelEmphasisToComfy 的输出）
 * @returns {string} 形如 `masterpiece, 1girl, detailed eyes`；无内容返回 ''
 */
export function stripAllWeights(normalizedText) {
    const normalized = String(normalizedText || '').trim();
    if (!normalized) return '';
    return collectBareTags(normalized).join(', ');
}

/**
 * krea2 适配：把一段（负面）提示词全部转成 `(tag:-1)` 形式，权重一律 -1。
 *
 * krea2 / flux 系工作流没有可用的 negative 输入，负面约束只能写进正面提示词，
 * 用 A1111 负权重语法表达。原权重一律丢弃——只保留"不要"这个方向。
 *
 * 处理链：convertNovelEmphasisToComfy 转换（复用两层解析，NAI `::` / `{}` / `[]`
 * 全部展开）→ 顶层逗号切分 → 剥掉整体包裹的权重壳 → 统一输出 -1。
 * 负权重 tag（`-1.4::watermark` 或 `(watermark:-1.4)`）不会被吞掉：转换把它就地
 * 留在串里，剥壳时连负号一起摘掉，再统一贴上 -1。
 * 不去重（重复 tag 会各输出一条）；幂等（`(x:-1)` 再跑一次仍是 `(x:-1)`）。
 *
 * @param {string} text 任意提示词串（已转换或含 NAI 语法均可）
 * @returns {string} 形如 `(bad hands:-1), (lowres:-1)`；无内容返回 ''
 */
export function toNegativeOneTags(text) {
    const normalized = convertNovelEmphasisToComfy(String(text || '').trim());
    if (!normalized) return '';
    return collectBareTags(normalized).map(tag => `(${tag}:-1)`).join(', ');
}

/* ============================================================================
 * Node 互操作层
 *
 * 以上全部逻辑零依赖，本模块可脱离 LWB 单独使用：
 *   - ESM:   import { convertNovelEmphasisToComfy } from '<本文件路径>';
 *   - CJS:   const { convertNovelEmphasisToComfy } = require('<本文件路径>');
 *            （需 Node >= 22.12 的 require(esm)；旧版请用动态 import）
 *   - CLI:   node prompt-emphasis.mjs "1.2::masterpiece, {blurry}, -1::watermark"
 *            node prompt-emphasis.mjs --negative-one "bad hands, lowres"
 *            node prompt-emphasis.mjs --flatten "1.2::masterpiece, {blurry}"
 *
 * 因为所在包 package.json 为 "type": "module"，Node 会把本文件当作 ESM 解析；
 * 浏览器中 process 为 undefined，isNodeMainModule() 直接返回 false，整段静默跳过。
 * 注意：Node 里 module 是全局（typeof 为 'function'），不要试图写 module.exports 兜底，
 * require(esm) 返回的本来就是真正的命名空间，额外赋值只会画蛇添足。
 * ========================================================================== */

export const NAI_EMPHASIS_API = {
    WEIGHT_STEP,
    parseNovelSections,
    extractWeightedTokens,
    convertNovelEmphasisToComfy,
    splitNegativeWeights,
    convertPromptPair,
    stripAllWeights,
    toNegativeOneTags,
};

/** 仅当本文件被 Node 作为主模块直接执行时为 true。 */
function isNodeMainModule() {
    if (typeof process === 'undefined' || !process.argv || !process.argv[1]) return false;
    let selfPath = '';
    try {
        selfPath = decodeURIComponent(new URL(import.meta.url).pathname || '');
    } catch {
        return false;
    }
    // Windows 下 file:///D:/a/b.js 的 pathname 是 /D:/a/b.js
    selfPath = selfPath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\\/g, '/').toLowerCase();
    const entry = String(process.argv[1]).replace(/\\/g, '/').toLowerCase();
    return selfPath === entry || selfPath.endsWith('/' + entry.replace(/^\.\//, ''));
}

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

/** 已知选项名。只认这些精确字符串，其余参数一律视为提示词的一部分。 */
const CLI_FLAGS = new Set(['-n', '--negative-one', '-f', '--flatten', '-h', '--help']);

const CLI_USAGE = `用法:
  node prompt-emphasis.mjs [选项] <提示词>
  echo "<提示词>" | node prompt-emphasis.mjs [选项]

选项:
  -n, --negative-one   输出 krea2 负权重形式 (tag:-1)
  -f, --flatten        权重全改 1：剥掉所有 (tag:N) 外壳，只留裸 tag
  -h, --help           显示本帮助
  --                   终止选项解析，其后参数一律当提示词

以 - 开头的提示词（负权重语法）可直接写，无需转义或分隔符：
  node prompt-emphasis.mjs --flatten "-1.4::watermark, 1.2::masterpiece"
只有在整条提示词恰好等于某个选项名时（如 "--flatten"）才需要 -- 隔开。

输出（统一是 { positive, negative } 两条串，负权重已分流到 negative）:
  默认          { positive, negative }
  --flatten     同上，但权重全改 1（两条串各剥一次壳）
  -n            纯文本 (tag:-1), ...`;

/**
 * 解析 CLI 参数。
 *
 * 与「以 - 开头即选项」的惯例不同，这里**只按选项名精确匹配**：
 * 提示词的负权重语法（`-1.4::watermark`）天然以 - 开头，
 * 若按前缀丢弃，最常用的负面提示词会被静默吞掉（然后误打印帮助）。
 * `--` 之后的一切参数都当提示词，用于极端情况（提示词本身就是 "--flatten"）。
 *
 * @param {string[]} argv 不含 node 与脚本路径的参数数组
 * @returns {{ input: string, help: boolean, negMode: boolean, flattenMode: boolean }}
 */
export function parseCliArgs(argv) {
    const flags = new Set();
    const parts = [];
    let literal = false;
    for (const arg of argv) {
        if (literal) {
            parts.push(arg);
            continue;
        }
        if (arg === '--') {
            literal = true;
            continue;
        }
        if (arg === '-') {
            // 惯用的 stdin 标记：不当作提示词，交给后面的 stdin 分支处理
            continue;
        }
        if (CLI_FLAGS.has(arg)) {
            flags.add(arg);
            continue;
        }
        parts.push(arg);
    }
    return {
        input: parts.join(' ').trim(),
        help: flags.has('-h') || flags.has('--help'),
        negMode: flags.has('-n') || flags.has('--negative-one'),
        flattenMode: flags.has('-f') || flags.has('--flatten'),
    };
}

async function runCli() {
    const { input: argvInput, help, negMode, flattenMode } = parseCliArgs(process.argv.slice(2));
    if (help) {
        console.log(CLI_USAGE);
        return;
    }
    let input = argvInput;
    if (!input && process.stdin && !process.stdin.isTTY) input = (await readStdin()).trim();
    if (!input) {
        console.log(CLI_USAGE);
        return;
    }
    if (negMode) {
        console.log(toNegativeOneTags(input));
        return;
    }
    // 与编译器同构：转换 + 分流拿到两条串；--flatten 只是在其上各剥一次壳
    const pair = convertPromptPair({ positive: input });
    if (flattenMode) {
        console.log(JSON.stringify({
            positive: stripAllWeights(pair.positive),
            negative: stripAllWeights(pair.negative),
        }, null, 2));
        return;
    }
    console.log(JSON.stringify(pair, null, 2));
}

if (isNodeMainModule()) {
    runCli().catch(err => {
        console.error((err && err.stack) || String(err));
        process.exitCode = 1;
    });
}
