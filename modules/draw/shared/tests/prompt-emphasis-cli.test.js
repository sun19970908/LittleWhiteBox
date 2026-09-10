import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCliArgs } from '../../providers/comfyui/prompt-emphasis.mjs';

test('CLI 不按前缀判定选项：以 - 开头的提示词不会被吞', () => {
    const r = parseCliArgs(['--flatten', '-1.4::watermark, watermark']);
    assert.equal(r.flattenMode, true);
    assert.equal(r.input, '-1.4::watermark, watermark');
});

test('CLI 纯负权重提示词（无选项）原样作为输入', () => {
    const r = parseCliArgs(['-1.4::watermark, bad hands']);
    assert.equal(r.input, '-1.4::watermark, bad hands');
    assert.equal(r.flattenMode, false);
    assert.equal(r.negMode, false);
    assert.equal(r.help, false);
});

test('CLI 选项与提示词混排都能识别', () => {
    const r = parseCliArgs(['-n', 'bad hands, -1.3::lowres']);
    assert.equal(r.negMode, true);
    assert.equal(r.input, 'bad hands, -1.3::lowres');
});

test('CLI -- 之后的参数一律当提示词', () => {
    const literal = parseCliArgs(['--', '--flatten']);
    assert.equal(literal.input, '--flatten');
    assert.equal(literal.flattenMode, false);

    const mixed = parseCliArgs(['--flatten', '--', '-n']);
    assert.equal(mixed.input, '-n');
    assert.equal(mixed.flattenMode, true);
    assert.equal(mixed.negMode, false);
});

test('CLI 单独的 - 视作 stdin 标记：不参与输入', () => {
    const r = parseCliArgs(['-']);
    assert.equal(r.input, '');
    assert.equal(r.flattenMode, false);
});

test('CLI -h / --help 触发帮助，且不影响其余解析', () => {
    assert.equal(parseCliArgs(['-h']).help, true);
    assert.equal(parseCliArgs(['--help']).help, true);
    assert.equal(parseCliArgs(['--help', 'x']).input, 'x');
    assert.equal(parseCliArgs([]).help, false);
});

test('CLI 多个位置参数按空格拼接（与旧 join 行为一致）', () => {
    assert.equal(parseCliArgs(['a,', 'b']).input, 'a, b');
    assert.equal(parseCliArgs([]).input, '');
});
