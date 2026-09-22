import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSummaryResult } from '../generate/summary-result.js';
import { parseEventRange } from '../vector/retrieval/temporal-turn-carrier.js';
import { formatModelArcProgress } from '../generate/arc-progress.js';

const event = (fields = {}) => ({ title: '归还钥匙', summary: '小红归还了钥匙。 (#21-22)', ...fields });
const context = { existingEvents: [{ id: 'evt-12' }, { id: 'evt-7' }], startFloor: 21, endFloor: 25 };
const prepare = (batch, source = context) => prepareSummaryResult(batch, source);

test('code assigns sequential IDs and resolves existing and batch references without mutating inputs', () => {
    const batch = { events: [
        event({ id: 'evt-7', causedBy: ['evt-7', 'new-3'], _addedAt: -10 }),
        event({ id: 'evt-7', causedBy: ['new-1'] }),
        event({ id: { invalid: true }, causedBy: ['evt-12', 'evt-12'] }),
        event(),
    ] };
    const before = structuredClone(batch);
    const result = prepare(batch);
    assert.deepEqual(result.events.map(item => item.id), ['evt-13', 'evt-14', 'evt-15', 'evt-16']);
    assert.deepEqual(result.events.map(item => item.causedBy), [['evt-7', 'evt-15'], ['evt-13'], ['evt-12'], []]);
    assert.equal(Object.hasOwn(result.events[0], '_addedAt'), false);
    assert.deepEqual(batch, before);
    assert.deepEqual(context.existingEvents, [{ id: 'evt-12' }, { id: 'evt-7' }]);
    assert.equal(prepare({ events: [event()] }, { ...context, existingEvents: [] }).events[0].id, 'evt-1');
    const lastAvailable = { ...context, existingEvents: [{ id: `evt-${Number.MAX_SAFE_INTEGER - 1}` }] };
    assert.equal(prepare({ events: [event()] }, lastAvailable).events[0].id, `evt-${Number.MAX_SAFE_INTEGER}`);
    assert.throws(() => prepare({ events: [event(), event()] }, lastAvailable), /事件编号/);
});

test('batch permanent IDs and local positions bind the same causes before persistence', () => {
    const batch = { events: [
        event({ causedBy: ['evt-15'] }),
        event({ causedBy: ['evt-13', 'new-1', 'evt-7'] }),
        event({ causedBy: ['evt-12'] }),
        event({ causedBy: ['evt-13', 'evt-14', 'new-2'] }),
    ] };
    const before = structuredClone(batch);
    const result = prepare(batch);
    const localReferences = { events: [
        event({ causedBy: ['new-3'] }),
        event({ causedBy: ['new-1', 'evt-7'] }),
        event({ causedBy: ['evt-12'] }),
        event({ causedBy: ['new-1', 'new-2'] }),
    ] };
    assert.deepEqual(result, prepare(localReferences));
    assert.deepEqual(result.events.map(item => item.causedBy), [['evt-15'], ['evt-13', 'evt-7'], ['evt-12'], ['evt-13', 'evt-14']]);
    assert.deepEqual(batch, before);
    assert.deepEqual(context.existingEvents, [{ id: 'evt-12' }, { id: 'evt-7' }]);
});

test('dangling, malformed and self causal references reject the batch', () => {
    for (const ref of ['evt-99', 'evt-15', 'evt-8', 'evt-13', 'evt-013', 'new-0', 'new-3', 'new-1', 'new-1.5', 'evt-7x', 7, '']) {
        const batch = { events: [event({ id: 'evt-99', causedBy: [ref] }), event()] };
        const before = structuredClone(batch);
        assert.throws(() => prepare(batch), /events\[0\]\.causedBy/, String(ref));
        assert.deepEqual(batch, before);
    }
    assert.throws(() => prepare({ events: [event({ causedBy: 'evt-7' })] }), /causedBy/);
});

test('three distinct direct causes survive binding and deduplication; four reject without mutation', () => {
    for (const refs of [
        ['evt-7', 'evt-12', 'new-2'],
        ['evt-7', 'evt-12', 'evt-14'],
        ['evt-7', 'evt-12', 'evt-14', 'new-2', 'evt-7'],
    ]) {
        const batch = { events: [event({ causedBy: refs }), event()] };
        const before = structuredClone(batch);
        assert.deepEqual(prepare(batch).events[0].causedBy, ['evt-7', 'evt-12', 'evt-14']);
        assert.deepEqual(batch, before);
    }
    const batch = { events: [event({ causedBy: ['evt-7', 'evt-12', 'new-2', 'new-3'] }), event(), event()] };
    const before = structuredClone(batch);
    assert.throws(() => prepare(batch), /events\[0\]\.causedBy/);
    assert.deepEqual(batch, before);
});

test('generated floor markers must map exactly to the supplied source, never clamped or reversed', () => {
    for (const marker of ['(#21)', '(#21-25)', '(#25-25)']) {
        const result = prepare({ events: [event({ summary: `正文 ${marker}` })] });
        const range = parseEventRange(result.events[0].summary);
        assert.equal(range.start, marker === '(#25-25)' ? 24 : 20);
        assert.equal(range.end, marker === '(#21)' ? 20 : 24);
    }
    for (const summary of ['无标注', '(#21-22)', '正文 (#0)', '正文 (#20-22)', '正文 (#21-26)',
        '正文 (#23-21)', '正文 (#999-1000)', '正文 (#21) (#22)', '正文 (#21.5-22)']) {
        assert.throws(() => prepare({ events: [event({ summary })] }), /events\[0\]\.summary/, summary);
    }
});

test('equivalent fullwidth source marker punctuation is canonicalized without changing prose', () => {
    for (const marker of ['（#21-22）', '（＃２１－２２）', '( #21 - 22 )', '(#21–22)', '(#21—22)',
        '(#21−22)', '(#21-#22)', '（ ＃２１ － ＃２２ ）']) {
        const result = prepare({ events: [event({ summary: `正文，保留全角标点，${marker}` })] });
        assert.equal(result.events[0].summary, '正文，保留全角标点，(#21-22)');
    }
    const prose = '角色说“字幕（压得凸起）”，房间（21），年龄(22)，然后离开';
    const result = prepare({ events: [event({ summary: `${prose} （#21）` })] });
    assert.equal(result.events[0].summary, `${prose} (#21)`);
});

test('missing source markers remain invalid because their floor cannot be inferred', () => {
    for (const summary of ['没有来源的事件', '正文（21-22）']) {
        assert.throws(() => prepare({ events: [event({ summary })] }), { code: 'source_missing', path: 'events[0].summary' });
    }
});

test('a unique explicit source is moved to the suffix without dropping narrative text', () => {
    for (const [summary, expected] of [
        ['（#21-22）两人离开。', '两人离开。 (#21-22)'],
        ['两人（#21-22）离开。', '两人离开。 (#21-22)'],
        ['两人离开（#21-22）。', '两人离开。 (#21-22)'],
        ['两人离开。 (#21、22)', '两人离开。 (#21-22)'],
    ]) {
        const batch = { events: [event({ summary })] };
        const before = structuredClone(batch);
        const result = prepare(batch);
        assert.equal(result.events[0].summary, expected);
        assert.deepEqual(parseEventRange(result.events[0].summary), { start: 20, end: 21 });
        assert.deepEqual(batch, before);
    }
});

test('malformed or multiple explicit sources cannot hide behind a valid suffix', () => {
    for (const summary of ['正文 (#abc) (#21)', '正文 (#21.5) （#22）', '正文 (#21) （#22）']) {
        assert.throws(() => prepare({ events: [event({ summary })] }), { code: 'source_ambiguous' });
    }
    assert.throws(() => prepare({ events: [event({ summary: '正文（＃２６）' })] }), { code: 'source_range' });
    assert.throws(() => prepare({ events: [event({ summary: '正文（#²¹）' })] }), { code: 'source_format' });
    assert.throws(() => prepare({ events: [event({ summary: '（#21）' })] }), { code: 'source_body_empty' });
});

test('explicit source lists become a bounded runtime envelope without changing model input or prose', () => {
    for (const marker of ['(#21、#23、#25)', '(#25, #21, #23)', '(#23，#25，#21)', '(#21、#25、#21)',
        '（＃２１，＃２３，＃２５）', '(#21、23、25)']) {
        const batch = { events: [event({ summary: `正文 ${marker}` })] };
        const before = structuredClone(batch);
        const result = prepare(batch);
        assert.equal(result.events[0].summary, '正文 (#21-25)');
        assert.deepEqual(parseEventRange(result.events[0].summary), { start: 20, end: 24 });
        assert.deepEqual(batch, before);
    }
    assert.equal(prepare({ events: [event({ summary: '正文 (#23、#23)' })] }).events[0].summary, '正文 (#23)');
});

test('source-list normalization rejects every out-of-batch member and ambiguous marker', () => {
    for (const marker of ['(#21、#26、#25)', '(#21、#0、#25)', '(#20、#25)',
        '(#21、#9007199254740992)', '(#21、#23.5)', '(#21、#-23)', '(#21、#23附近)',
        '(#21、)', '(#21-23、#25)', '(#21至#25)',
        '(#21) (#23、#25)', '(#21、#23) (#25)', '(#21、#23) (#24、#25)']) {
        const batch = { events: [event(), event({ summary: `正文 ${marker}` })] };
        const before = structuredClone(batch);
        assert.throws(() => prepare(batch), /events\[1\]\.summary/, marker);
        assert.deepEqual(batch, before);
    }
    assert.throws(() => prepare({ events: [event({ summary: '(#21、#25)' })] }), { code: 'source_body_empty' });
});

test('omitted update collections and empty events are legitimate; populated collections must be well formed', () => {
    assert.deepEqual(prepare({ events: [] }), {
        events: [], arcUpdates: [], factUpdates: [], keywords: [], newCharacters: [], characterAliasUpdates: [],
    });
    for (const field of ['events', 'arcUpdates', 'factUpdates', 'keywords', 'newCharacters', 'characterAliasUpdates']) {
        for (const value of [null, {}, '[]', [null]]) {
            assert.throws(() => prepare({ events: [], [field]: value }), error => error.message.startsWith(field));
        }
    }
    for (const fields of [{ title: '' }, { summary: {} }, { participants: [''] }, { memoryRole: 'unknown' }, { timeLabel: 2 }]) {
        assert.throws(() => prepare({ events: [event(fields)] }), /events\[0\]/);
    }
});

test('arc updates retain required content and reject non-numeric progress without mutating the batch', () => {
    const arc = { name: '小红', trajectory: '开始建立信任', progress: 70, newMoment: '归还了钥匙' };
    for (const fields of [{ trajectory: undefined }, { trajectory: '' }, { name: '' }, { progress: undefined },
        ...[null, NaN, Infinity, -Infinity, true, [], {}, '', ' ', '%', '75%%', '75/100', '75分', 'abc75', '75abc', '0x10']
            .map(progress => ({ progress })), { newMoment: {} }]) {
        const batch = { events: [event()], arcUpdates: [{ ...arc, ...fields }] };
        const before = structuredClone(batch);
        assert.throws(() => prepare(batch), { code: 'invalid_summary_field', path: `arcUpdates[0].${Object.keys(fields)[0]}` });
        assert.deepEqual(batch, before);
    }
});

test('model arc scores accept percentages, truncate decimals and clamp before ratio storage', () => {
    const arc = { name: '小红', trajectory: '开始建立信任', newMoment: '归还了钥匙' };
    for (const [progress, expected] of [
        [0, 0], [1, 0.01], [0.75, 0], [75, 0.75], [75.99, 0.75], [100, 1], [150, 1], [-1, 0], [-0.9, 0],
        ['75', 0.75], ['75%', 0.75], [' 75.99 % ', 0.75], ['150%', 1], ['-2.8%', 0], ['.9%', 0], ['+29.9', 0.29],
    ]) {
        const batch = { events: [event()], arcUpdates: [{ ...arc, progress }] };
        const before = structuredClone(batch);
        assert.deepEqual(prepare(batch).arcUpdates, [{ ...arc, progress: expected }]);
        assert.deepEqual(batch, before);
    }
    // Every stored hundredth re-enters the model as the same integer, including .29/.57.
    for (let score = 0; score <= 100; score++) {
        const ratio = prepare({ events: [], arcUpdates: [{ ...arc, progress: score }] }).arcUpdates[0].progress;
        assert.equal(formatModelArcProgress(ratio), score);
    }
});

test('missing relationship trend preserves fact content without inventing a label', () => {
    for (const p of ['对小蓝的看法', '对小蓝的态度', '与小蓝的关系']) {
        const fact = { s: '小红', p, o: '愿意共同承担责任', isState: true };
        for (const trend of [undefined, null, '', '  ']) {
            const batch = { events: [event()], factUpdates: [{ ...fact, trend }] };
            const before = structuredClone(batch);
            assert.deepEqual(prepare(batch).factUpdates, [fact]);
            assert.deepEqual(batch, before);
        }
    }
    const fact = { s: '小红', p: '对小蓝的看法', o: '愿意共同承担责任', isState: true };
    assert.deepEqual(prepare({ events: [], factUpdates: [{ ...fact, trend: ' 亲密 ' }] }).factUpdates, [{ ...fact, trend: '亲密' }]);
    for (const trend of ['未知倾向', 0, false, {}]) {
        assert.throws(() => prepare({ events: [], factUpdates: [{ ...fact, trend }] }), {
            code: 'invalid_summary_field', path: 'factUpdates[0].trend',
        });
    }
});

test('fact, character, keyword and alias updates project only valid update data', () => {
    const alias = { to: '李玄清', from: ['道长'], evidence: '#37 道长报出本名李玄清' };
    const result = prepare({
        events: [], newCharacters: [' 李玄清 '], keywords: [{ text: '钥匙', weight: '核心' }],
        factUpdates: [
            { s: ' 小红 ', p: '当前位置', o: '家中', isState: true, id: 'untrusted' },
            { s: '小红', p: '当前状态', retracted: true },
            { s: '小红', p: '对李玄清的看法', o: '信任', isState: true, trend: '投缘' },
        ],
        characterAliasUpdates: [alias],
    });
    assert.deepEqual(result.factUpdates, [
        { s: '小红', p: '位置', o: '家中', isState: true },
        { s: '小红', p: '状态', retracted: true },
        { s: '小红', p: '对李玄清的看法', o: '信任', isState: true, trend: '投缘' },
    ]);
    assert.deepEqual(result.characterAliasUpdates, [alias]);
    assert.deepEqual(result.newCharacters, ['李玄清']);
    assert.deepEqual(result.keywords, [{ text: '钥匙', weight: '核心' }]);
    for (const fact of [{ s: {}, p: '位置', o: '家' }, { s: '小红', p: '位置' },
        { s: '小红', p: '位置', o: '家', isState: 'false' }, { s: '小红', p: '位置', retracted: 'true' }]) {
        assert.throws(() => prepare({ events: [], factUpdates: [fact] }), /factUpdates\[0\]/);
    }
    assert.throws(() => prepare({ events: [], characterAliasUpdates: [{ ...alias, from: [] }] }), /characterAliasUpdates/);
});
