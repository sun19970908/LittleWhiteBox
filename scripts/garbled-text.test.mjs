import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { transformSync } from 'esbuild';
import { scanGarbledText, VERIFIED_REPLACEMENT_CHARACTERS } from './garbled-text.mjs';

const root = path.resolve(import.meta.dirname, '..');
const reviewed = VERIFIED_REPLACEMENT_CHARACTERS;
const artifact = fs.readFileSync(path.join(root, reviewed.file));

// 契约：只豁免已人工核实的依赖占位字符，不能放过别处的相同字符；代价是损坏内容被静默发布。
test('only the reviewed artifact and character positions are exempt', () => {
    assert.deepEqual(scanGarbledText(reviewed.file, artifact), []);
    const sourceHits = scanGarbledText('modules/example.js', artifact);
    assert.deepEqual(sourceHits.map(hit => hit.offset), [...reviewed.offsets]);
    assert.equal(scanGarbledText('dist/other.js', artifact).length, reviewed.offsets.length);
});

// 契约：同一产物、同一行或其他行出现的新乱码必须报错，内容变化也必须撤销旧豁免；代价同上。
test('new corruption on the same line or another line is still reported', () => {
    const broken = `const broken="\uFFFD${'?'.repeat(3)}";`;
    for (const [prefix, suffix] of [[broken, ''], ['', `\n${broken}`]]) {
        const bytes = Buffer.concat([Buffer.from(prefix), artifact, Buffer.from(suffix)]);
        const content = bytes.toString('utf8');
        const addedAt = prefix ? 0 : artifact.toString('utf8').length + 1;
        const hits = scanGarbledText(reviewed.file, bytes);
        const expectedOffsets = [...content.matchAll(/\uFFFD|\?{3}/g)].map(match => match.index);
        assert.deepEqual(hits.map(hit => hit.offset).sort((a, b) => a - b), expectedOffsets);
        const added = hits.find(hit => hit.offset === addedAt + broken.indexOf('\uFFFD'));
        assert.ok(added);
        assert.ok(added.preview.includes(broken));
    }
});

// 契约：UTF-8 字节损坏即便解码后看起来相同也不能沿用豁免；代价是编码损坏漏检。
test('the review fingerprint checks bytes rather than already decoded text', () => {
    const content = artifact.toString('utf8');
    const byteOffset = Buffer.byteLength(content.slice(0, reviewed.offsets[0]));
    const corrupted = Buffer.concat([
        artifact.subarray(0, byteOffset), Buffer.from([0xff]),
        artifact.subarray(byteOffset + Buffer.byteLength('\uFFFD')),
    ]);
    assert.equal(corrupted.toString('utf8'), content);
    assert.equal(scanGarbledText(reviewed.file, corrupted).length, reviewed.offsets.length);
});

// 构建产物契约：使用实际安装的 SDK 验证清洗语义和压缩后的字面量；不绑定易变的 chunk 名。
test('the installed SDK intentionally replaces only lone surrogates', async () => {
    const dependency = path.join(root, 'node_modules/@anthropic-ai/sdk/lib/internal/toolsets/sanitize.mjs');
    const { wellFormed } = await import('../node_modules/@anthropic-ai/sdk/lib/internal/toolsets/sanitize.mjs');
    assert.equal(wellFormed('A\uD800B\uDC00C\uD83D\uDE00'), 'A\uFFFDB\uFFFDC\uD83D\uDE00');
    const { code } = transformSync(fs.readFileSync(dependency, 'utf8'), { minify: true, charset: 'utf8', format: 'esm' });
    assert.equal(scanGarbledText('modules/example.js', Buffer.from(code)).length, 1);
    assert.deepEqual(scanGarbledText('dist/sdk.js', Buffer.from(code)), []);
});

const surrogatePattern = '/[\\uD800-\\uDFFF]/gu';
const sanitizer = `function clean(value){return value.replace(${surrogatePattern},"\uFFFD")}`;

// 契约：仅豁免替换字面量；同一行、其他行、注释及源码中的损坏不能随清洗器一起获得豁免。
test('sanitizers do not exempt neighboring corrupt text or source files', () => {
    const hoisted = `var lone=${surrogatePattern};function clean(value){return value.replace(lone,"\uFFFD")}`;
    for (const clean of [sanitizer, hoisted]) {
        assert.deepEqual(scanGarbledText('dist/sdk.js', Buffer.from(clean)), []);
        for (const separator of ['', '\n']) {
            const source = `${clean}${separator}const bad="\uFFFD${'?'.repeat(3)}";/* \uFFFD */`;
            const expected = [...source.matchAll(/\uFFFD|\?{3}/g)].map(match => match.index).filter(offset => offset >= clean.length);
            assert.deepEqual(scanGarbledText('dist/sdk.js', Buffer.from(source)).map(hit => hit.offset).sort((a, b) => a - b), expected);
        }
        for (const file of ['modules/sdk.js', 'dist/sdk.html', 'dist/sdk.css']) {
            assert.equal(scanGarbledText(file, Buffer.from(clean)).length, 1);
        }
    }
});

// 契约：正则、调用或绑定发生变化即撤销豁免；未知代码不能仅凭出现相同字符绕过扫描。
test('altered sanitizer regexes, calls and bindings fail closed', () => {
    const changed = [
        sanitizer.replace('/gu', '/g'),
        sanitizer.replace('/gu', '/u'),
        sanitizer.replace('/gu', '/giu'),
        sanitizer.replace('D800', 'D801'),
        sanitizer.replace('replace(', 'replaceAll('),
        sanitizer.replace('value.replace', 'other.replace'),
        sanitizer.replace('value.replace', 'value?.replace'),
        sanitizer.replace('"\uFFFD"', '"x\uFFFD"'),
        sanitizer.replace('return ', 'notify();return '),
        `var lone=${surrogatePattern};function clean(value){return value.replace(lone,"\uFFFD")}lone=/x/g;`,
        `var lone=${surrogatePattern};function clean(value,lone){return value.replace(lone,"\uFFFD")}`,
        `var lone=${surrogatePattern};function clean(value){return value.replace(lone,"\uFFFD")}function other(lone){return lone}`,
        `function outside(){var lone=${surrogatePattern};function clean(value){return value.replace(lone,"\uFFFD")}}`,
        `const notice="\uFFFD";${sanitizer}(`,
    ];
    for (const source of changed) {
        const expected = [...source.matchAll(/\uFFFD/g)].map(match => match.index);
        assert.deepEqual(scanGarbledText('dist/sdk.js', Buffer.from(source)).map(hit => hit.offset), expected, source);
    }
});

// 契约：UTF-8 损坏解码生成的 U+FFFD 不能因恰好落在清洗字面量内而被吞掉。
test('invalid UTF-8 cannot acquire the sanitizer exemption', () => {
    const source = Buffer.from(sanitizer), offset = source.indexOf(Buffer.from('\uFFFD'));
    const corrupted = Buffer.concat([source.subarray(0, offset), Buffer.from([0xff]), source.subarray(offset + 3)]);
    assert.equal(corrupted.toString('utf8'), sanitizer);
    assert.equal(scanGarbledText('dist/sdk.js', corrupted).length, 1);
});

// 构建产物契约：只识别已核实的二进制内容，旁边的文本、源码以及改动后的二进制仍须检查。
test('verified WASM bytes do not exempt surrounding text or changed payloads', () => {
    const dependency = fs.readFileSync(path.join(root, 'node_modules/@jitl/quickjs-singlefile-cjs-release-sync/dist/emscripten-module.cjs'), 'utf8');
    const pending = [parse(dependency, { ecmaVersion: 'latest' })];
    let payload;
    while (pending.length && !payload) {
        const node = pending.pop();
        const value = node.type === 'Literal' ? node.value
            : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked : null;
        if (typeof value === 'string' && value.startsWith('\0asm')) payload = value;
        for (const child of Object.values(node).flat()) {
            if (child && typeof child === 'object' && typeof child.type === 'string') pending.push(child);
        }
    }
    assert.ok(payload);
    const fixture = value => `const bytes=${JSON.stringify(value)};const notice="${'?'.repeat(3)}";`;
    const source = fixture(payload), artifactPath = 'dist/worker.js';
    const hits = scanGarbledText(artifactPath, Buffer.from(source));
    assert.deepEqual(hits.map(hit => hit.offset), [source.lastIndexOf('?'.repeat(3))]);
    assert.ok(scanGarbledText('modules/example.js', Buffer.from(source)).length > hits.length);
    const changed = payload.slice(0, 100) + String.fromCharCode(payload.charCodeAt(100) ^ 1) + payload.slice(101);
    assert.ok(scanGarbledText(artifactPath, Buffer.from(fixture(changed))).length > hits.length);
});

// 契约：真实检查入口必须继续扫描源码和构建产物，不能由文件收集阶段绕过；代价是检查覆盖缺失。
test('the CLI still scans source, other outputs and changes to the reviewed output', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lwb-garbled-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(path.join(directory, '.gitignore'), '');
    const target = path.join(directory, reviewed.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, artifact);
    const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/check-garbled.js')], { cwd: directory });
    assert.equal(run().status, 0);
    for (const file of ['modules/example.js', 'dist/other.js', 'dist/view.html', 'dist/style.css']) {
        const fixture = path.join(directory, file);
        fs.mkdirSync(path.dirname(fixture), { recursive: true });
        fs.writeFileSync(fixture, '\uFFFD');
        assert.equal(run().status, 1, file);
        fs.unlinkSync(fixture);
    }
    fs.appendFileSync(target, '\nconst broken="\uFFFD";');
    assert.equal(run().status, 1);
});
