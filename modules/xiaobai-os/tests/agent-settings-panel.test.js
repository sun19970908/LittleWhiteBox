import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';

import { normalizeAgentConfig } from '../../agent-core/config.js';
import { createAgentSettingsPanel } from '../../agent-core/ui/settings-panel.js';
import { buildAgentSettingsPanelMarkup } from '../../agent-core/ui/settings-markup.js';

function createPanelState(config) {
    return {
        config,
        configDraft: null,
        configDirty: false,
        configFormSyncPending: true,
        configPage: 'main',
        configSave: { status: 'idle', requestId: '', error: '' },
        modelOptionsByProvider: {},
        pullStateByProvider: {},
    };
}

function flushTasks() {
    return new Promise(resolve => globalThis.setTimeout(resolve, 0));
}

function mountAgentSettingsPanel(root) {
    const { document } = parseHTML(`<!doctype html><html><body>${buildAgentSettingsPanelMarkup({
        showAssistantPermissions: false,
        showDelegateSettings: false,
        showTavilySettings: false,
    })}</body></html>`);
    root.replaceChildren(...document.body.childNodes);
}

function installDom() {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const { document, window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
        configurable: true,
        get() {
            return this.querySelector('option[selected]')?.value || '';
        },
        set(value) {
            const requested = String(value ?? '');
            this.querySelectorAll('option').forEach((option) => {
                option.toggleAttribute('selected', option.value === requested);
            });
        },
    });
    globalThis.document = document;
    globalThis.window = window;
    return {
        document,
        restore() {
            if (previousDocument === undefined) {delete globalThis.document;}
            else {globalThis.document = previousDocument;}
            if (previousWindow === undefined) {delete globalThis.window;}
            else {globalThis.window = previousWindow;}
        },
    };
}

test('OS Agent form preserves Agent Core fields that it intentionally hides', () => {
    const dom = installDom();
    const { document } = dom;
    const root = document.querySelector('#root');
    const config = normalizeAgentConfig({ tavilyApiKey: 'keep-tavily-secret' });
    const state = createPanelState(config);
    let savedPayload = null;
    mountAgentSettingsPanel(root);
    const panel = createAgentSettingsPanel({
        state,
        saveConfig: request => {savedPayload = request.payload;},
    });

    try {
        panel.syncConfigToForm(root);
        panel.bindSettingsPanelEvents(root);
        assert.equal(root.querySelector('#xb-assistant-tavily-api-key'), null);
        root.querySelector('#xb-assistant-save').click();
        assert.equal(savedPayload.tavilyApiKey, 'keep-tavily-secret');
    } finally {
        dom.restore();
    }
});

test('OS Agent form does not pull models until the user clicks the pull action', async () => {
    const dom = installDom();
    const { document } = dom;
    const root = document.querySelector('#root');
    const state = createPanelState(normalizeAgentConfig({}));
    let pullCalls = 0;
    mountAgentSettingsPanel(root);
    const panel = createAgentSettingsPanel({
        state,
        pullModels: async () => {
            pullCalls += 1;
            return ['model-a'];
        },
    });

    try {
        panel.syncConfigToForm(root);
        panel.bindSettingsPanelEvents(root);
        assert.equal(pullCalls, 0);
        root.querySelector('#xb-assistant-pull-models').click();
        await flushTasks();
        assert.equal(pullCalls, 1);
    } finally {
        dom.restore();
    }
});
