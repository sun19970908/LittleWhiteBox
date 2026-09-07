import assert from 'node:assert/strict';
import test from 'node:test';

import { formatStorySummaryL2Events } from '../prompt-events.js';

test('L2 event projection filters future events and keeps complete chronological blocks', () => {
    const text = formatStorySummaryL2Events([
        { timeLabel: '二', title: '后', participants: ['乙'], summary: '后事件', _addedAt: 8 },
        { timeLabel: '一', title: '前', participants: ['甲'], summary: '前事件', _addedAt: 3 },
        { timeLabel: '三', title: '未来', participants: ['丙'], summary: '不应出现', _addedAt: 12 },
    ], { throughMessageIndex: 8, maxCharacters: 10_000 });
    assert.match(text, /前事件[\s\S]*后事件/);
    assert.doesNotMatch(text, /未来|不应出现/);
    assert.ok(text.indexOf('前事件') < text.indexOf('后事件'));
});

test('L2 projection drops whole event blocks rather than cutting a block', () => {
    const text = formatStorySummaryL2Events([
        { title: '旧', summary: '旧事件', participants: [], _addedAt: 1 },
        { title: '新', summary: '新'.repeat(100), participants: [], _addedAt: 2 },
    ], { throughMessageIndex: 2, maxCharacters: 20 });
    assert.equal(text, '旧\n摘要：旧事件');
    assert.ok(Array.from(text).length <= 20);
});

test('L2 projection excludes events without a trustworthy source boundary', () => {
    const text = formatStorySummaryL2Events([
        { title: '旧格式未知边界', summary: '不应进入 FIFO 背景' },
        { title: '空边界', summary: '仍然不应进入', _addedAt: null },
        { title: '负边界', summary: '也不应进入', _addedAt: -1 },
        { title: '数字字符串边界', summary: '也可以进入', _addedAt: '2' },
        { title: '已确认', summary: '可以进入', _addedAt: 3 },
    ], { throughMessageIndex: 3, maxCharacters: 1_000 });
    assert.match(text, /已确认|可以进入/u);
    assert.match(text, /数字字符串边界|也可以进入/u);
    assert.doesNotMatch(text, /未知边界|负边界|不应进入/u);
});
