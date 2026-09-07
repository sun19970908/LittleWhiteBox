import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';

import {
    enhanceChatMessageImageHtml,
    enhanceChatMessageImageTextNodes,
    normalizeChatMessageImageTags,
    resetPendingChatMessageImageSlots,
    restoreChatMessageImageSlots,
} from '../chat-message-image-markup.js';

test('disabled Draw preserves ordinary chat image markers', () => {
    const source = 'before [img: 1girl, smile] after';
    assert.equal(enhanceChatMessageImageHtml(source, false), source);
});

test('ordinary chat image aliases project to Draw-owned slots', () => {
    const result = enhanceChatMessageImageHtml('[图片: nsfw: 1girl, blue hair]', true);
    assert.match(result, /class="xb-img-slot"/);
    assert.match(result, /data-tags="nsfw%2C%201girl%2C%20blue%20hair"/);
});

test('ordinary chat image tags use the shared Draw prompt form', () => {
    assert.equal(normalizeChatMessageImageTags(' sketchy: 1girl,  blue hair, , smile '), 'nsfw, 1girl, blue hair, smile');
});

test('image projection changes visible text without rewriting attributes or code examples', () => {
    const { document } = parseHTML('<div id="message" data-example="[img: attribute]">before &lt;img src=x onerror=alert(1)&gt; [img: visible]<code>[img:hidden]</code></div>');
    const message = document.getElementById('message');

    assert.equal(enhanceChatMessageImageTextNodes(message, true), true);
    assert.equal(message.dataset.example, '[img: attribute]');
    assert.equal(message.querySelector('code').textContent, '[img:hidden]');
    assert.equal(message.querySelector('.xb-img-slot')?.dataset.tags, 'visible');
    assert.equal(message.querySelector('img'), null);
    assert.match(message.textContent, /<img src=x onerror=alert\(1\)>/);
});

test('Draw cleanup restores the exact original ordinary chat image marker', () => {
    const source = '[图片: Sketchy: 1girl, blue hair]';
    const { document } = parseHTML(`<div id="message">${enhanceChatMessageImageHtml(source, true)}</div>`);
    const message = document.getElementById('message');

    restoreChatMessageImageSlots(message);

    assert.equal(message.textContent, source);
});

test('Draw provider refresh releases only owned pending chat image slots for observation', () => {
    const { document } = parseHTML(`<div id="message">${enhanceChatMessageImageHtml('[img: 1girl]', true)}<div class="xb-img-slot" data-loading="1" data-observed="1"></div></div>`);
    const message = document.getElementById('message');
    const owned = message.querySelector('[data-xb-draw-chat-image="1"]');
    owned.dataset.loading = '1';
    owned.dataset.observed = '1';

    resetPendingChatMessageImageSlots(message);

    assert.equal(owned.dataset.loading, '');
    assert.equal(owned.dataset.observed, '');
    assert.equal(message.querySelector('.xb-img-slot:not([data-xb-draw-chat-image])').dataset.loading, '1');
});
