import { extension_settings, getContext } from '../../../../../../extensions.js';
import { isGenerating } from '../../../shared/common/sillytavern-generation-state.js';
import { createModuleEvents, event_types } from '../../../core/event-manager.js';
import { observeBackgroundTask } from '../../../shared/common/async-errors.js';
import { getStateInputSchema } from '../state2/json-input.js';
import { COPY } from './copy.js';
import { initializeSettings, readSettings, saveSettings } from './settings.js';
import { latestReply, collectMaterial, hasBodyUpdate } from './context.js';
import { buildUpdateTask } from './preset.js';
import { requestUpdate } from './transport.js';
import { createUpdateController } from './controller.js';
import { createUpdaterView } from './view.js';

let runtime;

export function initVariableUpdater(stateApi) {
    if (runtime) return;
    initializeSettings();
    const events = createModuleEvents('variableUpdater');
    let pendingGeneration, frame;
    const enabled = () => extension_settings.LittleWhiteBox?.variablesCore?.enabled && extension_settings.LittleWhiteBox?.variablesMode === '2.0';
    function assertAvailable() {
        if (!enabled()) throw new Error(COPY.enable);
        if (isGenerating()) throw new Error(COPY.busy);
    }
    async function assemble(ctx, target, snapshot, settings, signal) {
        const material = await collectMaterial(ctx, target, snapshot, settings, signal);
        return buildUpdateTask(settings.preset, material, getStateInputSchema());
    }
    function refresh() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            view.refresh();
            if (!enabled()) { controller.cancel(); document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove()); return; }
            try { view.mountControls(latestReply(), controller.status(), readSettings().mode); }
            catch { document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove()); }
        });
    }
    const controller = createUpdateController({ context: getContext, stateApi, assemble, request: requestUpdate,
        settings: readSettings, assertAvailable, changed: refresh });
    const api = {
        settings: readSettings, saveSettings(value) { saveSettings(value); if (value.mode === 'off') controller.cancel(); refresh(); },
        async preview(settings) {
            const ctx = getContext(), target = latestReply(ctx), turn = stateApi.stageTurn(target);
            const task = await assemble(ctx, target, turn.snapshot, settings);
            turn.assertCurrent(); return task;
        },
        async openAssistant() {
            const { openCardWorkspace } = await import('../../assistant/assistant.js');
            await openCardWorkspace({ variables: true });
        },
        update: () => controller.update(), cancel: controller.cancel, retrySave: controller.retrySave, status: controller.status,
    };
    const view = createUpdaterView(api);
    const cancelled = () => { pendingGeneration = null; controller.cancel(); refresh(); };
    events.on(event_types.GENERATION_STARTED, (type, _options, dryRun) => {
        if (dryRun || !['normal', 'regenerate', 'swipe', 'continue', undefined, ''].includes(type)) return;
        cancelled();
        pendingGeneration = { chat: getContext().chat };
    });
    events.on(event_types.MESSAGE_RECEIVED, id => {
        if (pendingGeneration?.chat === getContext().chat) pendingGeneration.message = getContext().chat[Number(id)];
        refresh();
    });
    for (const event of [event_types.CHAT_CHANGED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_DELETED, event_types.MESSAGE_UPDATED]) events.on(event, cancelled);
    for (const event of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED, event_types.SETTINGS_UPDATED]) events.on(event, refresh);
    runtime = {
        open: view.open,
        replyReady(id) {
            if (!pendingGeneration?.message || pendingGeneration.message !== getContext().chat[id]) return;
            pendingGeneration = null;
            if (hasBodyUpdate(getContext().chat[id])) return;
            if (enabled() && readSettings().mode === 'auto') observeBackgroundTask(controller.update().catch(error => {
                globalThis.toastr?.error(error.message, COPY.title);
            }), { source: import.meta.url, operation: 'autoUpdate' });
        },
        dispose() { events.cleanup(); controller.dispose(); cancelAnimationFrame(frame); view.dispose(); },
    };
    refresh();
}

export function openVariableSettings(page) {
    if (!runtime) throw new Error(COPY.enable);
    runtime.open(page);
}
export function notifyVariableReplyReady(id) { runtime?.replyReady(id); }
export function cleanupVariableUpdater() { runtime?.dispose(); runtime = null; }
