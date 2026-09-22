import assert from 'node:assert/strict';
import test from 'node:test';

import { createMessageButtonOwnership } from '../../../core/message-button-ownership.js';
import { mountMessageDecorators } from '../chat-surface/decorator-lifecycle.js';
import {
    inspectTauriTavernEnvironment,
} from '../environment.js';
import {
    LITTLEWHITEBOX_PARTICIPANT_ID,
    CHAT_SURFACE_PROTOCOL_VERSION,
} from '../chat-surface/participant.js';
import { claimIframeRuntimes } from '../features/iframe-renderer/runtime-claims.js';
import { getManagedLockedControlIds, getUnsupportedManagedFeatures } from '../feature-policy.js';
import { registerTauriTavernIntegration } from '../registration.js';
import { TAURITAVERN_ERROR_CODES } from '../diagnostics.js';
import { applyTauriTavernChatSurfaceSettingsLock, lockTauriTavernChatSurfaceSettings } from '../settings-ui.js';

function createSettings(overrides = {}) {
    return {
        enabled: true,
        immersive: { enabled: false },
        preview: { enabled: false },
        storyOutline: { enabled: false },
        tts: { enabled: false },
        xiaobaiOs: { enabled: false },
        ...overrides,
    };
}

function createRegistrationInput(overrides = {}) {
    return {
        environment: { managed: false, api: null },
        settings: createSettings(),
        hasActiveCustomTemplate: () => false,
        isDrawProviderActive: () => false,
        prepareContent() {},
        didMount() {},
        ...overrides,
    };
}

test('missing and older TauriTavern APIs remain on the static renderer', () => {
    assert.deepEqual(inspectTauriTavernEnvironment(undefined), { isTauriTavern: false, managed: false, api: null });
    assert.deepEqual(inspectTauriTavernEnvironment({ api: {} }), { isTauriTavern: true, managed: false, api: null });

    const api = { isManagedOwnershipRequired: () => false };
    assert.deepEqual(inspectTauriTavernEnvironment({ api: { chatSurface: api } }), {
        isTauriTavern: true,
        managed: false,
        api: null,
    });
});

test('managed ownership is frozen together with the exact host API', () => {
    const api = { isManagedOwnershipRequired: () => true };
    const environment = inspectTauriTavernEnvironment({ api: { chatSurface: api } });

    assert.equal(environment.managed, true);
    assert.equal(environment.api, api);
    assert.equal(Object.isFrozen(environment), true);
});

test('static environments do not register a participant', () => {
    let registered = false;
    const result = registerTauriTavernIntegration(createRegistrationInput({
        environment: {
            managed: false,
            api: { registerParticipant: () => { registered = true; } },
        },
    }));

    assert.equal(result, null);
    assert.equal(registered, false);
});

test('managed environments register the exact ChatSurface v1 participant', () => {
    const registration = { fault() {} };
    let definition;
    const api = {
        protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
        registerParticipant(nextDefinition) {
            definition = nextDefinition;
            return registration;
        },
    };
    const prepareContent = () => {};
    const didMount = () => {};

    const result = registerTauriTavernIntegration(createRegistrationInput({
        environment: { managed: true, api },
        prepareContent,
        didMount,
    }));

    assert.equal(result, registration);
    assert.deepEqual(definition, {
        id: LITTLEWHITEBOX_PARTICIPANT_ID,
        protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
        prepareContent,
        didMount,
    });
});

test('unsupported enabled features reject managed ownership before registration', () => {
    let registered = false;
    const settings = createSettings({
        immersive: { enabled: true },
        preview: { enabled: true },
    });
    const unsupported = getUnsupportedManagedFeatures({
        settings,
        hasActiveCustomTemplate: () => true,
        isDrawProviderActive: () => true,
    });

    assert.deepEqual(unsupported, [
        'immersive', 'preview', 'customTemplate',
    ]);
    assert.throws(() => registerTauriTavernIntegration(createRegistrationInput({
        environment: {
            managed: true,
            api: {
                protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
                registerParticipant() { registered = true; },
            },
        },
        settings,
        hasActiveCustomTemplate: () => true,
        isDrawProviderActive: () => true,
    })), error => {
        assert.equal(error.code, TAURITAVERN_ERROR_CODES.unsupportedFeatures);
        assert.deepEqual(error.featureIds, unsupported);
        return true;
    });
    assert.equal(registered, false);
});

test('managed ownership admits enabled OS, TTS and outline without requiring a backend', () => {
    const settings = createSettings({ xiaobaiOs: { enabled: true }, tts: { enabled: true }, storyOutline: { enabled: true } });

    assert.deepEqual(getUnsupportedManagedFeatures({
        settings,
        hasActiveCustomTemplate: () => false,
        isDrawProviderActive: () => false,
    }), []);
});

test('supported features can start and their controls remain mutable', () => {
    let registered = false;
    registerTauriTavernIntegration(createRegistrationInput({
        environment: {
            managed: true,
            api: {
                protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
                registerParticipant() { registered = true; },
            },
        },
        settings: createSettings({
            variablesPanel: { enabled: true },
            storySummary: { enabled: true },
        }),
    }));
    const controls = new Map(['xiaobaix_variables_panel_enabled', 'xiaobaix_story_summary_enabled']
        .map(id => [id, { disabled: false, setAttribute() {}, classList: { add() {} } }]));
    applyTauriTavernChatSurfaceSettingsLock({ getElementById: id => controls.get(id) });
    assert.equal(registered, true);
    assert.equal(controls.get('xiaobaix_variables_panel_enabled').disabled, false);
    assert.equal(controls.get('xiaobaix_story_summary_enabled').disabled, false);
});

test('draw can start under managed ownership and the master/draw controls remain usable', () => {
    let registered = false;
    const didCommitContent = () => {};
    registerTauriTavernIntegration(createRegistrationInput({
        environment: {
            managed: true,
            api: {
                protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
                registerParticipant(definition) {
                    registered = true;
                    assert.equal(definition.didCommitContent, didCommitContent);
                },
            },
        },
        isDrawProviderActive: () => true,
        didCommitContent,
    }));
    const controls = new Map(['xiaobaix_enabled', 'xiaobaix_draw_provider', 'xiaobaix_draw_open_settings', 'xiaobaix_reset_btn']
        .map(id => [id, { disabled: false, setAttribute() {}, classList: { add() {} } }]));
    applyTauriTavernChatSurfaceSettingsLock({ getElementById: id => controls.get(id) });
    assert.equal(registered, true);
    for (const id of ['xiaobaix_enabled', 'xiaobaix_draw_provider', 'xiaobaix_draw_open_settings']) {
        assert.equal(controls.get(id).disabled, false);
    }
    assert.equal(controls.get('xiaobaix_reset_btn').disabled, false);
});

test('ordinary SillyTavern settings are not touched by the integration lock', () => {
    lockTauriTavernChatSurfaceSettings({ getElementById() { assert.fail('Unexpected settings mutation'); } });
});

test('a disabled LittleWhiteBox still registers its required participant identity', () => {
    let registered = false;
    const settings = createSettings({
        enabled: false,
        immersive: { enabled: true },
    });
    const api = {
        protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
        registerParticipant() {
            registered = true;
            return {};
        },
    };

    registerTauriTavernIntegration(createRegistrationInput({
        environment: { managed: true, api },
        settings,
        hasActiveCustomTemplate: () => true,
        isDrawProviderActive: () => true,
    }));

    assert.equal(registered, true);
});

test('managed ownership rejects protocol mismatches', () => {
    assert.throws(() => registerTauriTavernIntegration(createRegistrationInput({
        environment: {
            managed: true,
            api: { protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION + 1, registerParticipant() {} },
        },
    })), error => error.code === TAURITAVERN_ERROR_CODES.unavailableChatSurface);
});

test('externally owned message buttons ignore module-wide cleanup', () => {
    const ownership = createMessageButtonOwnership();
    let cleanupCount = 0;

    assert.equal(ownership.runOwnedCleanup(() => { cleanupCount += 1; }), true);
    ownership.configure(false);
    assert.equal(ownership.ownsButtons(), false);
    assert.equal(ownership.runOwnedCleanup(() => { cleanupCount += 1; }), false);
    assert.equal(cleanupCount, 1);
});

test('message decorator disposer releases decorators and container exactly once', () => {
    const calls = [];
    const element = {};
    const release = mountMessageDecorators({
        element,
        mesid: 12,
        createContainerCleanup(receivedElement) {
            assert.equal(receivedElement, element);
            return () => calls.push('container:release');
        },
        decorators: [
            (_element, mesid) => { calls.push(`first:mount:${mesid}`); return () => calls.push('first:release'); },
            (_element, mesid) => { calls.push(`second:mount:${mesid}`); return () => calls.push('second:release'); },
        ],
    });

    assert.deepEqual(calls, ['first:mount:12', 'second:mount:12']);
    release();
    release();
    assert.deepEqual(calls, [
        'first:mount:12',
        'second:mount:12',
        'second:release',
        'first:release',
        'container:release',
    ]);
});

test('message decorator mount failure rolls back partial managed UI', () => {
    const calls = [];
    const failure = new Error();
    assert.throws(() => mountMessageDecorators({
        element: {},
        mesid: 7,
        createContainerCleanup: () => () => calls.push('container:release'),
        decorators: [
            () => () => calls.push('first:release'),
            () => { throw failure; },
        ],
    }), error => error === failure);
    assert.deepEqual(calls, ['first:release', 'container:release']);
});

test('only the three unvalidated features remain locked under managed ownership', () => {
    const attributes = new Map();
    const classes = new Set();
    const requestedIds = [];
    const control = {
        disabled: false,
        setAttribute(name, value) { attributes.set(name, value); },
        classList: { add(name) { classes.add(name); } },
    };
    const root = {
        getElementById(id) {
            requestedIds.push(id);
            return control;
        },
    };

    applyTauriTavernChatSurfaceSettingsLock(root);

    assert.deepEqual(requestedIds.sort(), ['xiaobaix_immersive_enabled', 'xiaobaix_preview_enabled', 'xiaobaix_template_enabled']);
    assert.deepEqual(getManagedLockedControlIds().sort(), requestedIds);
    assert.equal(control.disabled, true);
    assert.equal(attributes.get('aria-disabled'), 'true');
    assert.equal(classes.has('disabled-control'), true);
});

test('runtime claims include only renderable code blocks while rendering is enabled', () => {
    const mountRuntime = () => {};
    const codeBlocks = [
        { id: 'html', parentElement: { id: 'html-pre' } },
        { id: 'plain', parentElement: { id: 'plain-pre' } },
    ];
    const claimed = [];
    const content = {
        querySelectorAll(selector) {
            assert.equal(selector, 'pre > code');
            return codeBlocks;
        },
    };
    const claims = { claim(source, activate) { claimed.push({ source, activate }); } };

    claimIframeRuntimes({
        content,
        claims,
        settings: { enabled: true, renderEnabled: true },
        shouldRender: code => code.id === 'html',
        mountRuntime,
    });

    assert.deepEqual(claimed, [{ source: codeBlocks[0].parentElement, activate: mountRuntime }]);
});

test('render limits and toggles admit only configured floors on every content mount', () => {
    const source = {};
    const settings = { enabled: true, renderEnabled: true, maxRenderedMessages: 2 };
    const claimed = [];
    const mount = mesid => claimIframeRuntimes({
        content: { querySelectorAll: () => [{ parentElement: source }] },
        claims: { claim: () => claimed.push(mesid) },
        settings, mesid, chatLength: 10, shouldRender: () => true, mountRuntime() {},
    });
    mount(7); mount(8); mount(9);
    assert.deepEqual(claimed, [8, 9]);
    settings.maxRenderedMessages = 3;
    mount(7);
    assert.deepEqual(claimed, [8, 9, 7]);
    settings.renderEnabled = false;
    mount(9);
    settings.renderEnabled = true;
    settings.enabled = false;
    mount(9);
    assert.deepEqual(claimed, [8, 9, 7]);
});
