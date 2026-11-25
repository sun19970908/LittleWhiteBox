import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { createDefaultSettings } from './settings-model.js';
import { createSettingsRepository } from './settings-repository.js';
import { bindSettingsPresetBar } from './settings-preset-bar.js';
import { bindTestView } from './settings-test-view.js';

const PAGE = readFileSync(new URL('./settings.html', import.meta.url), 'utf8');
const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN3sAAAAASUVORK5CYII=';

test('parameter presets save drafts, survive failed writes, switch and delete safely', async () => {
    const { window, document } = parseHTML(PAGE);
    const provider = 'gemini';
    let persisted;
    let failure = false;
    let name = 'Portrait';
    window.prompt = () => name;
    window.confirm = () => true;
    const settings = createSettingsRepository(() => ({ getStrict: async () => null, setAndSave: async (_key, value) => {
        if (failure) throw Error('unavailable');
        persisted = value;
    } }));
    const root = document.querySelector('[data-presets="params"]');
    const input = document.querySelector('[name="positivePrefix"]');
    let fields;
    const bar = bindSettingsPresetBar({ root, label: 'Parameters', getState: () => settings.get(provider),
        persist: mutator => settings.update(provider, mutator), listKey: 'paramsPresets', selectionKey: 'selectedParamsPresetId',
        readFields: () => ({ ...fields, positivePrefix: input.value }),
        fillFields: value => { fields = value; input.value = value.positivePrefix; },
    });
    const action = async action => { root.querySelector(`[data-preset-action="${action}"]`).click(); await nextTurn(); };
    const select = root.querySelector('select');
    const selectPreset = async id => {
        for (const option of select.options) option.toggleAttribute('selected', option.value === id);
        select.dispatchEvent(new window.Event('change'));
        await nextTurn();
    };
    input.value = 'Watercolor';
    assert.equal(bar.isDirty(), true);
    await action('add');
    const portrait = persisted.selectedParamsPresetId;
    assert.notEqual(portrait, 'default');
    assert.equal(persisted.paramsPresets[1].positivePrefix, 'Watercolor');
    input.value = 'Unsaved';
    failure = true;
    await action('save');
    assert.equal(input.value, 'Unsaved');
    assert.equal(persisted.paramsPresets[1].positivePrefix, 'Watercolor');
    assert.ok(root.querySelector('[role="status"]').classList.contains('error'));
    failure = false;
    name = 'Illustration';
    await action('rename');
    assert.equal(persisted.paramsPresets[1].name, name);
    assert.equal(input.value, 'Unsaved');
    await selectPreset('default');
    assert.equal(persisted.selectedParamsPresetId, 'default');
    assert.equal(input.value, '');
    await selectPreset(portrait);
    assert.equal(input.value, 'Watercolor');
    await action('delete');
    assert.deepEqual(persisted.paramsPresets.map(item => item.id), ['default']);
    assert.equal(persisted.selectedParamsPresetId, 'default');
});

test('uploaded references reach only the current test request; removed and closed references do not leak', async () => {
    const { window, document } = parseHTML(PAGE);
    window.HTMLElement.prototype.scrollIntoView = () => {};
    const provider = 'openai';
    const settings = createDefaultSettings(provider);
    const image = new Blob([Uint8Array.from(atob(IMAGE), character => character.charCodeAt(0))], { type: 'image/png' });
    const inputs = [];
    let finish;
    const binding = bindTestView({ document, provider, getSettings: () => settings, report: () => {},
        readBlob: async blob => `data:${blob.type};base64,${IMAGE}`,
        loadRuntime: async () => ({ generateTestImage: (id, input) => {
            assert.equal(id, provider);
            inputs.push(input);
            return new Promise(resolve => { finish = resolve; });
        } }),
    });
    const $ = id => document.getElementById(id);
    const upload = async files => {
        $('mm-reference-files').files = files;
        $('mm-reference-files').dispatchEvent(new window.Event('change'));
        await nextTurn();
    };
    await upload([new Blob(['fake'], { type: 'text/html' }), image]);
    assert.equal($('mm-references').children.length, 0);
    await upload([image, image]);
    assert.equal($('mm-references').children.length, 2);
    $('mm-references').querySelector('button').click();
    $('mm-prompt').value = 'Retain the frame';
    $('mm-generate').click();
    await nextTurn();
    assert.deepEqual(inputs[0].referenceImages, [{ mimeType: 'image/png', data: IMAGE }]);
    assert.equal(inputs[0].prompt, 'Retain the frame');
    assert.equal(Object.hasOwn(inputs[0].settings, 'referenceImages'), false);
    $('mm-cancel').click();
    assert.equal(inputs[0].signal.aborted, true);
    finish({ images: [image] });
    await nextTurn();
    assert.equal($('mm-test-results').children.length, 1);
    $('mm-test-results').querySelector('button').click();
    await nextTurn();
    assert.equal($('mm-references').children.length, 2);
    binding.destroy();
    assert.equal($('mm-references').children.length, 0);
    assert.equal($('mm-test-results').children.length, 0);
});
