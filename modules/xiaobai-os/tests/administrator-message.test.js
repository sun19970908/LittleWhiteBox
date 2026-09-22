import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { parse, compileScript } from 'vue/compiler-sfc';
import { build } from 'esbuild';
import { administratorPage } from '../apps/administrator/application/projection.js';
import { createAdministratorData } from '../apps/administrator/domain/data.js';
import { ADMINISTRATOR_POLICY } from '../apps/administrator/domain/policy.js';

// Mount the production message with a plain-text renderer in place of Markdown.
// Text delivery/expansion is the contract here; real Markdown rendering is checked in the browser.
test('expanded administrator text survives overlapping revisions, errors and message switches', async t => {
    const dom = parseHTML('<html><body><div id="app"></div></body></html>');
    const previous = new Map();
    for (const key of ['window', 'document', 'Document', 'Node', 'Element', 'HTMLElement', 'SVGElement']) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
    }
    t.after(() => { for (const [key, descriptor] of previous) {
        if (descriptor) { Object.defineProperty(globalThis, key, descriptor); } else { delete globalThis[key]; }
    } });
    const { createApp, h, shallowRef, nextTick } = await import('vue');
    const path = new URL('../apps/administrator/ui/AdministratorMessage.vue', import.meta.url);
    const compiled = await build({ entryPoints: [fileURLToPath(path)], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
        plugins: [{ name: 'vue-components', setup(builder) {
            builder.onResolve({ filter: /^vue$/ }, () => ({ path: import.meta.resolve('vue'), external: true }));
            builder.onLoad({ filter: /MessageMarkdown\.vue$/ }, () => ({ contents:
                "import { h } from 'vue'; export default { props: ['text'], setup: props => () => h('div', { 'data-message-text': '' }, props.text) };", loader: 'js' }));
            builder.onLoad({ filter: /\.vue$/ }, args => {
                const { descriptor } = parse(readFileSync(args.path, 'utf8'), { filename: args.path });
                return { contents: compileScript(descriptor, { id: args.path, inlineTemplate: true }).content, loader: 'ts' };
            });
        } }],
    });
    // eslint-disable-next-line no-unsanitized/method -- Compiled repository components, not user input.
    const { default: Message } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const bodies = new Map();
    let pause = false, fail = false;
    const delayed = [];
    const rowFor = (revision, text, id = 'reply') => {
        bodies.set(`${id}:${revision}`, text);
        return administratorPage({ ...createAdministratorData(), revision, turns: [{ id, createdAt: 1, user: { text: 'request' },
            assistant: text, toolMessages: [], operations: [], status: 'finished', error: '' }] }).rows.find(row => row.role === 'assistant');
    };
    const original = 'paragraph '.repeat(1250);
    const latest = original.slice(0, -100) + 'new tail '.repeat(10);
    const row = shallowRef(rowFor(1, original)), chat = shallowRef('chat-a');
    const bridge = { async request(type, payload) {
        assert.equal(type, 'administrator/text');
        const body = bodies.get(`${payload.turnId}:${payload.revision}`);
        const result = { text: body.slice(payload.offset, payload.offset + ADMINISTRATOR_POLICY.textBlock), totalChars: body.length, offset: payload.offset };
        if (pause) { pause = false; await new Promise(resolve => delayed.push(resolve)); }
        if (fail) { throw new Error('transport unavailable'); }
        return { result };
    } };
    const app = createApp({ setup: () => () => h(Message, { row: row.value, bridge, chatIdentity: chat.value, disabled: false }) });
    app.mount(dom.document.getElementById('app'));
    t.after(() => app.unmount());
    const flush = async () => { await setImmediate(); await nextTick(); };
    const content = () => dom.document.querySelector('[data-message-text]')?.textContent.trim();
    const more = () => dom.document.querySelector('.admin-pager button');
    await flush();
    while (more()) {
        const before = content();
        more().click(); await flush();
        assert.notEqual(content(), before);
    }
    assert.equal(content(), original.trim());

    pause = true; row.value = rowFor(2, original); await flush();
    assert.equal(delayed.length, 1);
    assert.equal(content(), original.trim());
    row.value = rowFor(3, latest); await flush();
    assert.equal(content(), latest.trim()); assert.equal(more(), null);
    delayed.shift()(); await flush();
    assert.equal(content(), latest.trim());

    fail = true; row.value = rowFor(4, latest); await flush();
    assert.ok(more()); assert.equal(more().disabled, false);
    fail = false; more().click(); await flush();
    assert.equal(content(), latest.trim()); assert.equal(more(), null);

    pause = true; row.value = rowFor(5, latest); await flush();
    const other = 'other message '.repeat(900);
    row.value = rowFor(1, other, 'another'); chat.value = 'chat-b'; await flush();
    assert.equal(content(), row.value.text.trim()); assert.ok(more());
    delayed.shift()(); await flush();
    assert.equal(content(), row.value.text.trim());
});
