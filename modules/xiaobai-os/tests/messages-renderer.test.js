import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, parseHTML } from 'linkedom';
import { renderPrivateMessages } from '../apps/messages/host/message-renderer.js';
import { PRIVATE_MESSAGE_MARKER } from '../apps/messages/application/projection.js';
import { projectionText } from '../domains/messages/transcript.js';

function entry(contact, sender, text, payload) {
    return { id: text, contactId: contact, sender, from: sender === 'user' ? '玩家' : contact,
        to: sender === 'user' ? contact : '玩家', payload: payload ?? { type: 'text', text }, createdAt: 0 };
}

function floor(entries, segmentId = 'segment', recovered = false) {
    const messages = entries.map((message, i) => ({ ...message, seq: i + 1 }));
    return { mes: projectionText({ messages }, { messageIds: messages.map(m => m.id), recovered }),
        extra: { [PRIVATE_MESSAGE_MARKER]: { version: 1, segmentId, throughSeq: messages.length, digest: 'a'.repeat(64) } } };
}

function mount(t) {
    const previous = globalThis.DOMParser;
    globalThis.DOMParser = DOMParser;
    t.after(() => {
        if (previous === undefined) {delete globalThis.DOMParser;}
        else {globalThis.DOMParser = previous;}
    });
    const { document } = parseHTML('<html><body><div class="mes" mesid="0"><div class="mes_text">原始正文</div></div></body></html>');
    return { document, target: document.querySelector('.mes_text'), render: message => renderPrivateMessages([message], document) };
}

test('private floor groups consecutive contacts without reordering or rewriting the saved transcript', t => {
    const h = mount(t);
    const message = floor([entry('甲', 'user', '第一句'), entry('甲', 'character', '第二句'),
        entry('乙', 'character', '第三句'), entry('甲', 'user', '第四句')], 'segment', true);
    const original = structuredClone(message);
    h.render(message);
    assert.deepEqual(message, original);
    assert.deepEqual([...h.target.querySelectorAll('h4')].map(n => n.textContent), ['与甲', '与乙', '与甲']);
    assert.deepEqual([...h.target.querySelectorAll('article')].map(n => n.textContent), ['第一句', '第二句', '第三句', '第四句']);
    assert.equal(h.target.querySelector('article').getAttribute('aria-label'), '玩家发给甲');
    assert.match(h.target.querySelector('p').textContent, /此前已发生/u);
    assert.equal(h.target.querySelector('details').hasAttribute('open'), true);
    assert.match(h.target.querySelector('summary').textContent, /4 条消息/u);
    assert.equal(h.target.querySelector('small'), null);
});

test('long floors start folded; user choice survives new messages and native text replacement only for the same segment', t => {
    const h = mount(t);
    const entries = Array.from({ length: 7 }, (_, i) => entry('甲', 'user', `消息${i}`));
    const message = floor(entries);
    h.render(message);
    const details = h.target.querySelector('details');
    assert.equal(details.hasAttribute('open'), false);
    details.setAttribute('open', '');
    h.render(message);
    assert.equal(h.target.querySelector('details'), details);
    h.target.textContent = '宿主重绘';
    h.render(floor([...entries, entry('甲', 'character', '新增回复')]));
    assert.equal(h.target.querySelector('details').hasAttribute('open'), true);
    h.target.querySelector('details').removeAttribute('open');
    h.render(floor([entry('甲', 'user', '变短了')]));
    assert.equal(h.target.querySelector('details').hasAttribute('open'), false);
    h.render(floor([entry('乙', 'user', '新的片段')], 'new-segment'));
    assert.equal(h.target.querySelector('details').hasAttribute('open'), true);
    assert.equal(h.target.querySelector('h4'), null);
    assert.match(h.target.querySelector('summary').textContent, /与乙的通讯/u);
    h.render(floor([entry('乙', 'user', '长'.repeat(1601))], 'long-text'));
    assert.equal(h.target.querySelector('details').hasAttribute('open'), false);
    assert.ok(h.target.querySelector('.xb-private-preview').textContent.length < 100);
});

test('media remains inert text except validated local photos; host editing and unrelated floors are left alone', t => {
    const h = mount(t);
    const safe = `/user/images/xb-os-messages/${'a'.repeat(64)}.png`;
    const message = floor([entry('甲', 'user', 'photo', { type: 'image', description: '<script>not markup</script>', attachment: { path: safe, name: '照片' } }),
        entry('甲', 'character', 'voice', { type: 'voice', transcript: '听得到吗？' })]);
    h.render(message);
    assert.equal(h.target.querySelector('img').getAttribute('src'), safe);
    assert.equal(h.target.querySelector('script'), null);
    assert.match(h.target.textContent, /<script>not markup<\/script>/u);
    assert.match(h.target.textContent, /［语音］听得到吗/u);
    h.render({ ...message, mes: message.mes.replace(safe, 'https://example.org/tracker.png') });
    assert.equal(h.target.querySelector('img'), null);
    h.target.textContent = '原生编辑内容';
    const editor = h.document.createElement('textarea'); editor.className = 'edit_textarea'; h.target.parentNode.append(editor);
    h.render(message);
    assert.equal(h.target.textContent, '原生编辑内容');
    editor.remove();
    h.render({ mes: message.mes });
    h.render({ ...message, mes: '<其他内容>手动改写</其他内容>' });
    assert.equal(h.target.textContent, '原生编辑内容');
});
