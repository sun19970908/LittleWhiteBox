import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { fixture as drawFixture } from './helpers/draw-journey.js';
import { projectGalleryPrompt } from '../gallery-prompt.js';
import { createGalleryPromptView } from '../../providers/novelai/gallery-prompt-view.js';

// Acceptance (cost: silently misreporting saved generation inputs): read the
// chosen original, including old records; no writes, image payload or stale
// reply may replace its inputs. Read failure is retryable, not an empty prompt.
async function viewFixture(t) {
    const html = await readFile(new URL('../../providers/novelai/novel-draw.html', import.meta.url), 'utf8');
    const { document } = parseHTML(html);
    const requests = [];
    const view = createGalleryPromptView(document, data => requests.push(data));
    t.after(() => view.close());
    const reply = prompt => view.receive({ requestId: requests.at(-1).requestId, prompt });
    const text = field => document.getElementById('nd_modal_' + field).textContent;
    return { document, view, requests, reply, text };
}

test('gallery prompt reads old original records without changing the index, record or current settings', async t => {
    const h = await drawFixture(['body']); t.after(h.stop);
    const original = { imgId: 'original', slotId: 'slot', characterName: 'Alice', timestamp: 123,
        base64: 'aGVsbG8=', tags: 'old tags', positive: 'old positive', negativePrompt: 'old negative',
        postPrompt: 'old suffix', characterPrompts: [{ name: 'Alice', prompt: 'blue dress', uc: 'hat' }], vibeNames: 'old Vibe' };
    await h.api.importPortablePreviews([original]);
    h.api.getSharedDrawSettings().messageFilterRules = [{ start: 'unrelated', end: '' }];
    const before = await h.api.getPreview(original.imgId);
    const page = await h.api.getCharacterSlotsPage('Alice');
    assert.equal(page.slots.slot[0].positive, undefined);
    const v = await viewFixture(t);
    v.view.open(original.imgId);
    const projection = projectGalleryPrompt(await h.api.getPreview(v.requests[0].imgId));
    assert.equal(projection.base64, undefined);
    v.reply(projection);
    for (const [field, expected] of [['tags', original.tags], ['positive', original.positive],
        ['negative', original.negativePrompt], ['vibe', original.vibeNames], ['post', original.postPrompt]]) {
        assert.equal(v.text(field), expected);
    }
    assert.ok(v.text('character').includes('blue dress'));
    assert.ok(v.text('character').includes('hat'));
    assert.deepEqual(await h.api.getPreview(original.imgId), before);
    assert.deepEqual(h.counters.requests, []);
    assert.equal(h.counters.saves, 0);
});

test('close, reopen, selection and out-of-order replies cannot show another image prompt', async t => {
    const v = await viewFixture(t);
    v.view.open('one'); const oldRequest = v.requests.at(-1);
    v.view.close();
    v.view.open('two');
    v.view.receive({ requestId: oldRequest.requestId, prompt: { imgId: 'one', positive: 'wrong' } });
    assert.equal(v.text('positive'), '');
    v.reply({ imgId: 'two', positive: 'right' });
    assert.equal(v.text('positive'), 'right');
    v.view.selected('three');
    assert.equal(v.view.isOpen(), false);
    assert.equal(v.document.getElementById('nd_gallery_modal').inert, false);
});

test('read failure offers a fresh read, distinct from a record with no stored prompts', async t => {
    const v = await viewFixture(t);
    v.view.open('one');
    v.reply(null);
    assert.equal(v.document.getElementById('nd_prompt_retry').hidden, false);
    v.document.getElementById('nd_prompt_retry').click();
    assert.equal(v.requests.length, 2);
    assert.notEqual(v.requests[0].requestId, v.requests[1].requestId);
    v.reply({ imgId: 'one' });
    assert.equal(v.document.getElementById('nd_prompt_retry').hidden, true);
    assert.equal(v.document.getElementById('nd_prompt_status').hidden, false);
});
