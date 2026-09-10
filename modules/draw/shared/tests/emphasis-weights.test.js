import test from 'node:test';
import assert from 'node:assert/strict';

import { buildComfyImageRequest } from '../../providers/comfyui/compiler.js';
import {
    convertNovelEmphasisToComfy,
    convertPromptPair,
    splitNegativeWeights,
    stripAllWeights,
    toNegativeOneTags,
} from '../../providers/comfyui/prompt-emphasis.mjs';

const CUSTOM_WORKFLOW = {
    p: { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    n: { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    size: { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512 } },
    sampler: { class_type: 'KSampler', inputs: { seed: 0 } },
    save: { class_type: 'SaveImage', inputs: { images: ['sampler', 0] } },
};

function compileWith(recipe, { prompt, negativePrompt = '' }) {
    return buildComfyImageRequest({
        prompt,
        negativePrompt,
        params: { width: 832, height: 1216 },
        recipe: {
            workflowMode: 'custom',
            customWorkflow: {
                json: JSON.stringify(CUSTOM_WORKFLOW),
                nodePositive: 'p',
                nodeNegative: 'n',
                nodeWidth: 'size',
                nodeHeight: 'size',
                nodeSeed: 'sampler',
                nodeSaveImage: 'save',
            },
            ...recipe,
        },
        seed: 1,
    });
}

test('stripAllWeights 剥掉所有权重壳、保留原顺序与重复且幂等', () => {
    assert.equal(stripAllWeights('(masterpiece:1.2), 1girl, (detailed eyes:1.05)'), 'masterpiece, 1girl, detailed eyes');
    // 不去重：内容一字不改，重复 tag 各保留一条
    assert.equal(stripAllWeights('a, (a:1.3), (b:0.9)'), 'a, a, b');
    // 幂等：已经剥过的再跑一次不变
    assert.equal(stripAllWeights(stripAllWeights('(a:1.2), b')), 'a, b');
    assert.equal(stripAllWeights(''), '');
    // 括号内的逗号不该被切坏
    assert.equal(stripAllWeights('(a, b:1.2), c'), 'a, b, c');
});

test('全链路不做去重：自然语言里的重复分句也原样保留', () => {
    const sentence = 'a girl standing in the rain, smiling softly, a girl standing in the rain';
    assert.equal(stripAllWeights(sentence), sentence);
    // 全角逗号不参与切分，整句就是一个单元
    const zh = '一个金发少女，微笑着，一个金发少女';
    assert.equal(stripAllWeights(zh), zh);
});

test('权重全改 1 = 转换 + 分流 + stripAllWeights，负权重仍留在 negative', () => {
    const pair = convertPromptPair({
        positive: '1.2::masterpiece, {blurry}, [simple background], -1.4::watermark',
    });
    assert.equal(stripAllWeights(pair.positive), 'masterpiece, blurry, simple background');
    assert.equal(stripAllWeights(pair.negative), 'watermark');
});

test('toNegativeOneTags 在重构后行为不变（回归）', () => {
    assert.equal(toNegativeOneTags('bad hands, lowres, (worst quality:1.2)'), '(bad hands:-1), (lowres:-1), (worst quality:-1)');
    assert.equal(toNegativeOneTags(''), '');
    // 幂等
    assert.equal(toNegativeOneTags(toNegativeOneTags('x, y')), '(x:-1), (y:-1)');
});

test('权重全改 1 关闭时编译器输出与改动前一致', () => {
    const request = compileWith({}, { prompt: '1.2::masterpiece, {blurry}, -1.4::watermark', negativePrompt: '1.3::bad hands' });
    assert.equal(request.workflow.p.inputs.text, '(masterpiece:1.2), (blurry:1.26)');
    assert.equal(request.workflow.n.inputs.text, '(bad hands:1.3), (watermark:1.4)');
});

test('权重全改 1 打开时正面、负面与分流出的负权重 tag 都不带权重', () => {
    const request = compileWith({ flattenEmphasisWeights: true }, {
        prompt: '1.2::masterpiece, {blurry}, -1.4::watermark',
        negativePrompt: '1.3::bad hands',
    });
    assert.equal(request.workflow.p.inputs.text, 'masterpiece, blurry');
    // 负权重 tag 仍留在 negative 槽位（方向不变），但不再带 (watermark:1.4) 外壳
    assert.equal(request.workflow.n.inputs.text, 'bad hands, watermark');
    assert.equal(/\d\.\d/.test(request.workflow.p.inputs.text), false);
});

test('权重全改 1 不跨来源去重：负面框与分流出的同名 tag 各保留一条', () => {
    const on = compileWith({ flattenEmphasisWeights: true }, {
        prompt: '1girl, -1.4::watermark',
        negativePrompt: 'watermark, bad hands',
    });
    assert.equal(on.workflow.n.inputs.text, 'watermark, bad hands, watermark');
    // 关闭时只是多带了权重壳，重复照旧（joinTags 只拼接不去重）
    const off = compileWith({}, {
        prompt: '1girl, -1.4::watermark',
        negativePrompt: 'watermark, bad hands',
    });
    assert.equal(off.workflow.n.inputs.text, 'watermark, bad hands, (watermark:1.4)');
});

test('权重全改 1 与 krea2 合流同开：合流产生的 (tag:-1) 不被剥离', () => {
    const request = compileWith({ flattenEmphasisWeights: true, mergeNegativeIntoPositive: true }, {
        prompt: '1.2::masterpiece, -1.4::watermark',
        negativePrompt: 'bad hands',
    });
    assert.equal(request.workflow.p.inputs.text, 'masterpiece, (bad hands:-1), (watermark:-1)');
    assert.equal(request.workflow.n.inputs.text, '');
});

test('权重全改 1 保持幂等：已归一的提示词再跑一次结果不变', () => {
    const once = compileWith({ flattenEmphasisWeights: true }, { prompt: '1.2::a, a' });
    assert.equal(once.workflow.p.inputs.text, 'a, a');
    const twice = compileWith({ flattenEmphasisWeights: true }, { prompt: once.workflow.p.inputs.text });
    assert.equal(twice.workflow.p.inputs.text, 'a, a');
});

test('分流不做去重：同名负权重 tag 各分流一条（回归上游行为变更）', () => {
    assert.equal(
        convertNovelEmphasisToComfy('-1.4::watermark, -1::watermark, -2::watermark'),
        '(watermark:-1.4), (watermark:-1), (watermark:-2)',
    );
    assert.equal(
        splitNegativeWeights('(watermark:-1.4), (watermark:-1), (watermark:-2)').negative,
        '(watermark:1.4), watermark, (watermark:2)',
    );
});

test('转换器仍是幂等的：已转换的 (tag:N) 文本再转换不叠加权重', () => {
    const first = convertNovelEmphasisToComfy('1.2::masterpiece');
    assert.equal(first, '(masterpiece:1.2)');
    assert.equal(convertNovelEmphasisToComfy(first), '(masterpiece:1.2)');
});

test('转换器不判归属：负权重就地写成 (tag:-N) 留在串里', () => {
    assert.equal(
        convertNovelEmphasisToComfy('1.2::masterpiece, -1.4::watermark, -1::signature'),
        '(masterpiece:1.2), (watermark:-1.4), (signature:-1)',
    );
    assert.equal(convertNovelEmphasisToComfy('-1.4::watermark'), '(watermark:-1.4)');
    // 段落权重不特殊对待 A1111 负权重壳：要保住方向就得用 :: 截断段落
    assert.equal(convertNovelEmphasisToComfy('1.2::girl::, (qipao:-1)'), '(girl:1.2), (qipao:-1)');
    // 幂等
    assert.equal(convertNovelEmphasisToComfy('(watermark:-1.4)'), '(watermark:-1.4)');
});

test('分流只认壳内负号：(tag:-N) 归 negative 并摘掉负号', () => {
    assert.deepEqual(splitNegativeWeights('girl, (forehead mark:-1), (qipao:-1.4), (gray eyes:1.6)'), {
        positive: 'girl, (gray eyes:1.6)',
        negative: 'forehead mark, (qipao:1.4)',
    });
    // 裸 tag 与正权重壳都留在正面；括号内的逗号不切坏
    assert.deepEqual(splitNegativeWeights('a, (b, c:1.2)'), { positive: 'a, (b, c:1.2)', negative: '' });
    assert.deepEqual(splitNegativeWeights(''), { positive: '', negative: '' });
    // 幂等：产物里已无负号壳，再切一次不再变化
    const once = splitNegativeWeights('girl, (a:-1)');
    assert.deepEqual(once, { positive: 'girl', negative: 'a' });
    assert.deepEqual(splitNegativeWeights(once.negative), { positive: 'a', negative: '' });
});

test('包装：正面走转换+分流，负面只走转换，最后合并；负面串不参与分流', () => {
    assert.deepEqual(convertPromptPair({
        positive: '1.2::masterpiece::, (forehead mark:-1)',
        negative: '1.3::bad hands',
    }), {
        positive: '(masterpiece:1.2)',
        negative: '(bad hands:1.3), forehead mark',
    });
    // 负面框里的裸 tag 不带负号，若对负面串也跑分流就会被当成正面搬走
    assert.deepEqual(convertPromptPair({ positive: '1girl', negative: 'bad hands, lowres' }), {
        positive: '1girl',
        negative: 'bad hands, lowres',
    });
    // 两侧都空 / 未传
    assert.deepEqual(convertPromptPair({}), { positive: '', negative: '' });
    assert.deepEqual(convertPromptPair(), { positive: '', negative: '' });
});

test('回归：A1111 负权重 (tag:-1) 开启「权重全改 1」后不会翻转成正面 tag', () => {
    const request = compileWith({ flattenEmphasisWeights: true }, {
        prompt: 'girl, slender, phoenix eyes, 1.6::gray eyes, white pupils::, (forehead mark:-1), (qipao:-1)',
        negativePrompt: 'bad hands',
    });
    // 负号承载方向，剥壳只该剥权重，不该把 tag 搬回正面
    assert.equal(request.workflow.p.inputs.text, 'girl, slender, phoenix eyes, gray eyes, white pupils');
    assert.equal(request.workflow.n.inputs.text, 'bad hands, forehead mark, qipao');
});

test('回归：toNegativeOneTags 不再吞掉负权重 tag', () => {
    assert.equal(toNegativeOneTags('bad hands, -1.4::watermark'), '(bad hands:-1), (watermark:-1)');
    assert.equal(toNegativeOneTags('bad hands, (watermark:-1.4)'), '(bad hands:-1), (watermark:-1)');
});
