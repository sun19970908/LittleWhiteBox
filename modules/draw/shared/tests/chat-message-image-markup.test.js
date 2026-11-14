import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { parseChatImageTags, findRenderedChatImageTags, normalizeChatMessageImageTags, collectFilterRuleRanges } from '../chat-message-image-markup.js';
import { DEFAULT_MESSAGE_FILTER_RULES } from '../message-filter-rules.js';

// Acceptance (cost: unwanted charges / wrong chat replacement): filtered tags
// never submit requests, while body tags retain their exact original positions.

test('tag aliases normalize input while retaining exact source offsets', () => {
    const source = '前文[图片: sketchy: 1girl,  smile, ]后文[img: tree]';
    const tags = parseChatImageTags(source);
    assert.equal(tags.length, 2);
    assert.equal(tags[0].tags, 'nsfw, 1girl, smile');
    for (const tag of tags) assert.equal(source.slice(tag.start, tag.end), tag.marker);
    assert.equal(normalizeChatMessageImageTags('a,, b'), 'a, b');
});

test('code, comments, escapes and HTML attributes are not image requests', () => {
    const source = [
        '`[img: inline]` [img: yes]',
        '```text\n[img: fenced]\n```',
        '    [img: indented]',
        '<div title="[img: attr]">[图片: visible]</div>',
        '<pre>[img: htmlcode]</pre><!--[img: comment]-->',
        '\\[img: escaped]',
        '<script>"[img: script]"</script>',
    ].join('\n');
    assert.deepEqual(parseChatImageTags(source).map(item => item.tags), ['yes', 'visible']);
});

test('identical tags remain distinct positions, in text traversal order', () => {
    const source = '[img: a] [img: b] [img: a]';
    const { document } = parseHTML(`<div>${source}</div>`);
    const { matched, unmatched } = findRenderedChatImageTags(document.querySelector('div'), parseChatImageTags(source));
    assert.deepEqual(matched.map(item => item.candidate.start), [0, 9, 18]);
    assert.equal(unmatched.length, 0);
});

test('display-only and ambiguous duplicate output is not assigned a raw position', () => {
    const { document } = parseHTML('<div>[img: a] [img: synthetic]<code>[img: c]</code></div>');
    const result = findRenderedChatImageTags(document.querySelector('div'), parseChatImageTags('[img: a] [img: a]'));
    assert.equal(result.matched.length, 0);
    assert.equal(result.unmatched.length, 2);
});

test('visible text can be matched without changing code or attributes', () => {
    const source = '<div title="[img: attribute]">[img: visible]<code>[img: code]</code></div>';
    const { document } = parseHTML(source);
    const root = document.querySelector('div');
    const result = findRenderedChatImageTags(root, parseChatImageTags(source));
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].candidate.tags, 'visible');
    assert.equal(root.getAttribute('title'), '[img: attribute]');
});

test('filterRules excludes tags inside <think>/<thinking>/<status> blocks', () => {
    const filterRules = [
        { start: '<think>', end: '</think>' },
        { start: '<thinking>', end: '</thinking>' },
        { start: '<status>', end: '</status>' },
        { start: '<mind>', end: '</mind>' },
    ];
    const source = [
        '<think>思考中[img: think-a][img: think-b]</think>',
        '正文[img: visible-a]',
        '<status>状态栏[img: status-a]</status>',
        '<thinking>隐藏推理[img: think-c]</thinking>',
        '第二段正文[img: visible-b]',
    ].join('\n');
    const tags = parseChatImageTags(source, filterRules);
    assert.deepEqual(tags.map(t => t.tags), ['visible-a', 'visible-b']);
});

test('collectFilterRuleRanges handles adjacent paired rules', () => {
    const source = '<think>a</think><status>b</status>[img: ok]';
    const ranges = collectFilterRuleRanges(source, [
        { start: '<think>', end: '</think>' },
        { start: '<status>', end: '</status>' },
    ]);
    assert.deepEqual(ranges, [[0, 34]]);
    assert.deepEqual(parseChatImageTags(source, [
        { start: '<think>', end: '</think>' },
        { start: '<status>', end: '</status>' },
    ]).map(t => t.tags), ['ok']);
});

test('collectFilterRuleRanges handles single-end rules (start-only)', () => {
    const source = '[img: a]<think>should-be-removed[img: b]';
    const ranges = collectFilterRuleRanges(source, [{ start: '<think>', end: '' }]);
    // start-only: everything from <think> onwards is excluded
    assert.deepEqual(ranges, [[source.indexOf('<think>'), source.length]]);
});

test('collectFilterRuleRanges handles single-end rules (end-only)', () => {
    const source = '[img: a]之前</think>[img: b]之后';
    const ranges = collectFilterRuleRanges(source, [{ start: '', end: '</think>' }]);
    // end-only: everything up to and including </think> is excluded
    const idx = source.indexOf('</think>');
    assert.deepEqual(ranges, [[0, idx + '</think>'.length]]);
    assert.deepEqual(parseChatImageTags(source, [{ start: '', end: '</think>' }]).map(t => t.tags), ['b']);
});

test('filterRules with identical case-insensitive tags match', () => {
    const source = '<Status>[img: hidden]</Status>正文[img: ok]';
    const tags = parseChatImageTags(source, [{ start: '<status>', end: '</status>' }]);
    assert.deepEqual(tags.map(t => t.tags), ['ok']);
});

test('filterRules empty or missing excludes nothing (backward compatible)', () => {
    const source = '<think>[img: a]</think>[img: b]';
    assert.equal(parseChatImageTags(source).length, 2);
    assert.equal(parseChatImageTags(source, []).length, 2);
    assert.equal(parseChatImageTags(source, null).length, 2);
});

test('filtered and body occurrences of identical tags keep the body raw position', () => {
    const source = '<private>[img: same]</private>正文[img: same]<status>[img: other]</status>';
    const rules = [{ start: '<private>', end: '</private>', keep: true }, ...DEFAULT_MESSAGE_FILTER_RULES];
    const { document } = parseHTML(`<div class="mes_text">${source}</div>`);
    const root = document.querySelector('.mes_text');
    const result = findRenderedChatImageTags(root, parseChatImageTags(source), new Map(), parseChatImageTags(source, rules));
    assert.deepEqual(result.matched.map(item => item.candidate.start), [source.indexOf('[img: same]', source.indexOf('正文'))]);
});

test('default paired and unmatched closing think rules do not consume earlier body tags', () => {
    const source = '[img: before]<think>[img: hidden]</think>[img: after]<status>[img: status]</status>';
    assert.deepEqual(parseChatImageTags(source, DEFAULT_MESSAGE_FILTER_RULES).map(tag => tag.tags), ['before', 'after']);
    const unmatched = '[img: hidden]</think>[img: body]';
    assert.deepEqual(parseChatImageTags(unmatched, DEFAULT_MESSAGE_FILTER_RULES).map(tag => tag.tags), ['body']);
});

test('all filter forms preserve raw offsets and keep blocks cannot trigger images', () => {
    const source = '[img: body]<keep>[img: hidden]</keep><cut>[img: hidden]';
    const tags = parseChatImageTags(source, [{ start: '<keep>', end: '</keep>', keep: true }, { start: '<cut>', end: '' }]);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].tags, 'body');
    assert.equal(source.slice(tags[0].start, tags[0].end), tags[0].marker);
});
