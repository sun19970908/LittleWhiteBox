import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { normalizeSharedDrawSettings } from '../../../shared/draw-settings.js';
import { parseChatImageTags } from '../../../shared/chat-message-image-markup.js';

// Acceptance (cost: unintended paid image requests / lost custom configuration):
// - Saving the displayed defaults, reopening, or resetting and saving keeps
//   image tags in filtered blocks out of generation candidates.
// - Opening and saving custom rules preserves their exact values and keep flags.
register('./host-lib-hook.mjs', import.meta.url);

test('the actual filter form preserves default exclusions and custom rules across save/reopen/reset', async t => {
    const { window, document } = parseHTML(readFileSync(new URL('../novel-draw.html', import.meta.url), 'utf8'));
    // linkedom does not reflect a checkbox's checked attribute into its property.
    Object.defineProperty(window.HTMLInputElement.prototype, 'checked', {
        configurable: true,
        get() { return this.hasAttribute('checked'); },
        set(value) { this.toggleAttribute('checked', Boolean(value)); },
    });
    const selectProto = Object.getPrototypeOf(document.createElement('select'));
    Object.defineProperty(selectProto, 'value', {
        configurable: true,
        get() {
            const options = [...this.querySelectorAll('option')];
            const selected = options.find(option => option.hasAttribute('selected')) ?? options[0];
            return selected?.getAttribute('value') ?? selected?.textContent ?? '';
        },
        set(value) {
            for (const option of this.querySelectorAll('option')) {
                option.toggleAttribute('selected', (option.getAttribute('value') ?? option.textContent) === String(value));
            }
        },
    });
    const ready = Promise.withResolvers(), posted = [], storage = new Map();
    const noop = () => {};
    Object.assign(window, {
        location: new URL('http://localhost/'),
        parent: { postMessage(message) {
            posted.push(structuredClone(message));
            if (message.type === 'FRAME_READY') ready.resolve();
        } },
        matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
        requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
        alert: noop, confirm: () => true, scrollTo: noop,
    });
    const globals = {
        window, document, parent: window.parent, navigator: window.navigator,
        HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node,
        Event: window.Event, CustomEvent: window.CustomEvent, MutationObserver: window.MutationObserver,
        ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
        IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
        requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
        alert: window.alert, confirm: window.confirm, getComputedStyle: () => ({}), matchMedia: window.matchMedia,
        localStorage: { getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    };
    for (const [key, value] of Object.entries(globals)) {
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    t.after(() => window.dispatchEvent(new window.Event('pagehide')));
    await import('../novel-draw-page.js');
    await ready.promise;
    const receive = (type, data) => window.dispatchEvent(Object.assign(new window.Event('message'), {
        origin: window.location.origin, source: window.parent,
        data: { source: 'LittleWhiteBox-NovelDraw', type, ...data },
    }));
    const open = rules => receive('INIT_DATA', { settings: { messageFilterRules: rules }, cacheStats: {} });
    const save = () => {
        document.getElementById('nd_filter_save').click();
        const request = posted.at(-1);
        assert.equal(request.type, 'SAVE_MESSAGE_FILTER_RULES');
        const saved = normalizeSharedDrawSettings({ messageFilterRules: request.rules }).messageFilterRules;
        receive('STATUS', { target: 'filter', state: 'success' });
        return structuredClone(saved);
    };
    const source = ['think', 'status', 'status_bar', '状态栏', '状态', 'mind']
        .map(name => `<${name}>[img: forbidden ${name}]</${name}>`).join('') + '[img: body]';
    const checkCandidates = rules => assert.deepEqual(parseChatImageTags(source, rules).map(tag => tag.tags), ['body']);
    open([]);
    const defaults = save();
    checkCandidates(defaults);
    open(defaults);
    checkCandidates(save());

    const custom = [{ start: '<private>', end: '</private>', keep: true }, { start: '<tail>', end: '' }];
    open(custom);
    assert.deepEqual(save(), custom);
    document.getElementById('nd_filter_reset').click();
    const reset = save();
    checkCandidates(reset);
    open(reset);
    checkCandidates(save());
});
