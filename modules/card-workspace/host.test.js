import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { COPY } from './copy.js';
import { equalJson, equalText } from './comparison.js';
import { CARD_FIELDS, projectCard, projectItem, json } from './files.js';

// C1: newline representation and JSON key order cannot block unchanged content;
// real text/array/value changes still conflict (lost edits / false save failures).
function harness() {
    const card = { name: 'fixture', avatar: 'fixture.png', data: { extensions: { regex_scripts: [{ id: 'one', scriptName: 'one', replaceString: 'old' }] } } };
    let book = { entries: { 1: { uid: 1, content: 'old', comment: 'one' } } }, writes = 0;
    const ctx = { characters: [card], characterId: 0, eventSource: { emit: async () => {} }, eventTypes: {} };
    const reversed = obj => Object.fromEntries(Object.entries(obj).reverse());
    const source = readFileSync(new URL('./host.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
    const api = runInNewContext(source + '\n({assertUnchanged,saveFile})', {
        COPY, equalJson, equalText, CARD_FIELDS, projectCard, projectItem, json, structuredClone,
        variableCardHost: () => ({}), getContext: () => ctx, getRequestHeaders: () => ({}),
        DOMPurify: { sanitize: v => v }, select_selected_character() {}, allowScopedScripts() {},
        newWorldInfoEntryTemplate: {}, originalWIDataKeyMap: {}, setWIOriginalDataValue() {},
        worldInfoCache: new Map(), updateWorldInfoList: async () => {},
        fetch: async (url, options) => {
            const body = JSON.parse(options.body);
            if (url === '/api/characters/merge-attributes') { writes++; card.data.extensions.regex_scripts = body.data.extensions.regex_scripts.map(reversed); }
            else if (url === '/api/worldinfo/edit') { writes++; book = body.data; book.entries[1] = reversed(book.entries[1]); }
            return { ok: true, json: async () => structuredClone(url.includes('worldinfo') ? book : card) };
        },
    });
    return { ...api, writes: () => writes };
}

test('C1: only line-ending representation is ignored; JSON settings retain semantic conflict checks', () => {
    const { assertUnchanged } = harness();
    assert.equal(assertUnchanged({ originalContent: 'a\nb\n', content: 'A\nb\n' }, 'a\r\nb\r\n'), true);
    assert.equal(assertUnchanged({ originalContent: 'old', content: 'a\nb' }, 'a\r\nb'), false);
    for (const changed of ['a\nc\n', 'a \nb\n', 'a\nb', 'a\n\nb\n']) {
        assert.throws(() => assertUnchanged({ originalContent: 'a\nb\n', content: 'A\nb\n' }, changed), { message: COPY.conflict });
    }
    assert.equal(assertUnchanged({ originalContent: '{"a":1,"b":2}', content: '{"a":3,"b":2}' }, '{"b":2,"a":1}', true), true);
    assert.equal(equalJson({ a: [1, 2] }, { a: [2, 1] }), false);
});

test('C1: regex and worldbook saves confirm equal JSON despite reordered response keys', async () => {
    const host = harness();
    for (const target of [{ avatar: 'fixture.png', kind: 'regex', id: 'one', settings: false },
        { avatar: 'fixture.png', kind: 'world', id: 1, book: 'fixture', settings: false }]) {
        const result = await host.saveFile(target, { content: 'new', originalContent: 'old' });
        assert.equal(result.contents[0], 'new');
    }
    assert.equal(host.writes(), 2);
});
