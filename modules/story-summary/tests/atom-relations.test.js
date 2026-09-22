import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { build } from 'esbuild';
import { buildRAggregateText } from '../vector/pipeline/state-vector-input.js';

// Exercise the public extractor with a controlled model response. Only host
// logging, configured text filtering and the network boundary are substituted.
const bundled = await build({
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'extraction-boundaries', setup(api) {
        api.onResolve({ filter: /(?:llm-service|text-filter|debug-core)\.js$/ }, args => ({ path: path.basename(args.path), namespace: 'boundary' }));
        api.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents:
            args.path.endsWith('llm-service.js')
                ? 'let response; export function setResponse(value) { response = value; } export async function callLLM() { return JSON.stringify(response); }'
                : args.path.endsWith('text-filter.js') ? 'export const filterText = text => text;'
                    : 'export const xbLog = { info() {}, warn() {}, error() {} };',
        }));
    } }],
    stdin: { contents: [
        "export { extractAtomsForRound } from './modules/story-summary/vector/llm/atom-extraction.js';",
        "export { setResponse } from './modules/story-summary/vector/llm/llm-service.js';",
    ].join('\n'), resolveDir: process.cwd() },
});
// eslint-disable-next-line no-unsanitized/method -- Locally compiled product code and fixed test stubs.
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const scene = '甲在会议室再次拒绝乙提出的交易，并明确说明保留原有协议的理由。';
async function extract(edges) {
    mod.setResponse({ anchors: [{ scene, edges, where: '会议室' }] });
    return mod.extractAtomsForRound(null, { mes: scene }, 8);
}

test('model relations retain recurrence, aspect, objects and word boundaries through extraction and vector input', async () => {
    const relations = [
        '再次拒绝交易', '继续等待答复', '开始调查原因', '正在核查证据',
        '提出非常规交易', '说明与对方继续合作必须满足的具体条件', '确认交易已经通过',
        'refuses to sign again', '拒绝交易，但继续协商',
    ];
    for (const relation of relations) {
        const [atom] = await extract([{ s: '甲', t: '乙', r: relation }]);
        assert.deepEqual(atom.edges, [{ s: '甲', t: '乙', r: relation.normalize('NFKC') }]);
        assert.equal(atom.semantic, scene);
        assert.equal(atom.where, '会议室');
        assert.equal(buildRAggregateText(atom), relation.normalize('NFKC'));
    }
});

test('relation preservation retains empty-edge rejection, edge limit and harmless text cleanup', async () => {
    const [atom] = await extract([null, {}, { s: '甲', t: '', r: '再次拒绝交易' },
        { s: '甲', t: '乙', r: '\u200b ' }, { s: '甲', t: '乙', r: '好' },
        { s: '甲', t: '乙', r: ' ， 。 ' }, { s: '甲', t: '乙', r: '好。' },
        { s: ' 甲 ', t: '乙 ', r: ' \u200b再次拒绝交易\ufeff ' },
        { s: '乙', t: '甲', r: '继续请求协商' }, { s: '甲', t: '乙', r: '开始说明原因' },
        { s: '乙', t: '甲', r: '正在记下条件' }]);
    assert.deepEqual(atom.edges, [
        { s: '甲', t: '乙', r: '再次拒绝交易' },
        { s: '乙', t: '甲', r: '继续请求协商' },
        { s: '甲', t: '乙', r: '开始说明原因' },
    ]);
    const [empty] = await extract(null);
    assert.deepEqual(empty.edges, []);
    assert.equal(buildRAggregateText(empty), scene);
});
