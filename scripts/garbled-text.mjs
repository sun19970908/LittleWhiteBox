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

function verifiedBinaryRanges(relativePath, source) {
    if (!relativePath.startsWith('dist/') || !relativePath.endsWith('.js')) return [];
    let tree;
    try { tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        // 无法解析的文本不获得任何豁免，仍由下面的扫描完整报告。
        return [];
    }
    const ranges = [], pending = [tree];
    while (pending.length) {
        const node = pending.pop();
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
    const binary = hits.length ? verifiedBinaryRanges(relativePath, source) : [];
    return hits.filter(hit => !binary.some(([start, end]) => hit.offset >= start && hit.offset < end));
}
