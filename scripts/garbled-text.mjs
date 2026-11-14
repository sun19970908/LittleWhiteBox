import { createHash } from 'node:crypto';
import { parse } from 'acorn';

// 已核实：mdurl/lib/decode.mjs 用替换字符表示非法 UTF-8；markdown-it 的 normalize 用它替换 NUL。
// 只豁免该产物中这些 UTF-16 字符偏移，不豁免文件/行。原始字节指纹变化后全部失效，须重新核验。
export const VERIFIED_REPLACEMENT_CHARACTERS = Object.freeze({
    file: 'dist/shared/markdown-it-CnQ4poDy.js',
    sha256: '0cbf709ff85bc8d0c23227d3e200968ac9fb30914427d8c0992e9033e8114c29',
    offsets: Object.freeze([632, 633, 871, 872, 873, 1165, 1166, 1167, 1168, 1254, 57711]),
});

// @jitl/quickjs-singlefile-cjs-release-sync 0.32.0 的原始 WASM；已与构建中的两个副本逐字节核对。
// 只豁免产物中解码后指纹完全一致的字节字符串，不豁免文件、行或其他文本。
const VERIFIED_WASM_SHA256 = '105c3bed22d457e43e3d1c3c1c6959fda62a8fe06f0fc8a985303c3a2be72232';

// @anthropic-ai/sdk 1.8.0 src/lib/internal/toolsets/sanitize.ts:28-31 的 wellFormed。
// u 保留有效代理对，g 替换所有孤立代理；仅认可这个单返回函数中的替换字面量。
function isLoneSurrogateRegex(node) {
    return node?.type === 'Literal' && node.regex?.pattern === '[\\uD800-\\uDFFF]'
        && ['gu', 'ug'].includes(node.regex.flags);
}

function sanitizerReplacement(node, bindings, identifiers) {
    if (node.type !== 'FunctionDeclaration' || node.async || node.generator
        || node.params.length !== 1 || node.params[0].type !== 'Identifier' || node.body.body.length !== 1) return null;
    const statement = node.body.body[0], parameter = node.params[0].name;
    if (statement.type !== 'ReturnStatement') return null;
    const call = statement.argument;
    if (call?.type !== 'CallExpression' || call.optional || call.arguments.length !== 2) return null;
    const member = call.callee;
    if (member.type !== 'MemberExpression' || member.computed || member.optional
        || member.object.type !== 'Identifier' || member.object.name !== parameter
        || member.property.type !== 'Identifier' || member.property.name !== 'replace') return null;
    const [pattern, replacement] = call.arguments;
    if (replacement.type !== 'Literal' || replacement.value !== '\uFFFD') return null;
    if (isLoneSurrogateRegex(pattern)) return replacement;
    if (pattern.type !== 'Identifier' || pattern.name === parameter || pattern.name === node.id?.name) return null;
    const binding = bindings.get(pattern.name), references = identifiers.get(pattern.name);
    // 只接受顶层正则绑定，且除此声明和这一处实参外不得再出现同名标识符；拒绝重赋值、遮蔽和别名。
    return binding && references?.length === 2 && references.includes(binding.id) && references.includes(pattern)
        ? replacement : null;
}

function verifiedLiteralRanges(relativePath, source, validUtf8) {
    if (!relativePath.startsWith('dist/') || !relativePath.endsWith('.js')) return [];
    let tree;
    try { tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        // 无法解析的文本不获得任何豁免，仍由下面的扫描完整报告。
        return [];
    }
    const bindings = new Map(), identifiers = new Map(), functions = [];
    for (const statement of tree.body) {
        if (statement.type !== 'VariableDeclaration') continue;
        for (const binding of statement.declarations) {
            if (binding.id.type === 'Identifier' && isLoneSurrogateRegex(binding.init)) bindings.set(binding.id.name, binding);
        }
    }
    const ranges = [], pending = [tree];
    while (pending.length) {
        const node = pending.pop();
        if (node.type === 'Identifier') {
            if (!identifiers.has(node.name)) identifiers.set(node.name, []);
            identifiers.get(node.name).push(node);
        }
        if (node.type === 'FunctionDeclaration') functions.push(node);
        const value = node.type === 'Literal' ? node.value
            : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked : null;
        if (typeof value === 'string' && value.startsWith('\0asm') && [...value].every(char => char.charCodeAt(0) <= 255)
            && createHash('sha256').update(Buffer.from(value, 'latin1')).digest('hex') === VERIFIED_WASM_SHA256) {
            ranges.push([node.start, node.end]);
        }
        for (const child of Object.values(node).flat()) {
            if (child && typeof child === 'object' && typeof child.type === 'string') pending.push(child);
        }
    }
    if (validUtf8) {
        for (const node of functions) {
            const replacement = sanitizerReplacement(node, bindings, identifiers);
            if (replacement) ranges.push([replacement.start, replacement.end]);
        }
    }
    return ranges;
}

const patterns = [
    { name: 'question-marks', regex: /\?\?\?/g },
    { name: 'replacement-char', regex: /\uFFFD/g },
];

export function scanGarbledText(relativePath, bytes) {
    const reviewed = VERIFIED_REPLACEMENT_CHARACTERS;
    const approved = relativePath === reviewed.file
        && createHash('sha256').update(bytes).digest('hex') === reviewed.sha256;
    const allowedOffsets = new Set(approved ? reviewed.offsets : []);
    const source = bytes.toString('utf8');
    const lines = source.split('\n');
    const hits = [];
    let lineOffset = 0;
    for (const [index, line] of lines.entries()) {
        for (const { name, regex } of patterns) {
            for (const match of line.matchAll(regex)) {
                const offset = lineOffset + match.index;
                if (match[0] === '\uFFFD' && allowedOffsets.has(offset)) continue;
                hits.push({
                    line: index + 1,
                    column: match.index + 1,
                    offset,
                    name,
                    preview: line.slice(Math.max(0, match.index - 60), match.index + 140).replace(/\t/g, '\\t').replace(/\r$/, ''),
                });
            }
        }
        lineOffset += line.length + 1;
    }
    const verified = hits.length ? verifiedLiteralRanges(relativePath, source, Buffer.from(source).equals(bytes)) : [];
    return hits.filter(hit => !verified.some(([start, end]) => hit.offset >= start && hit.offset < end));
}
