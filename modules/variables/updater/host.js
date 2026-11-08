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
import { removeLegacyResults } from './legacy-result.js';

let runtime;

export function initVariableUpdater(stateApi) {
    if (runtime) return;
    initializeSettings();
    const events = createModuleEvents('variableUpdater');
    let pendingGeneration, frame, swipeRecovery;
    const enabled = () => extension_settings.LittleWhiteBox?.variablesCore?.enabled && extension_settings.LittleWhiteBox?.variablesMode === '2.0';
    function assertAvailable() {
        if (!enabled()) throw new Error(COPY.enable);
        if (isGenerating()) throw new Error(COPY.busy);
    }
    async function assemble(ctx, target, settings, signal) {
        const material = await collectMaterial(ctx, target, settings, signal);
        return buildUpdateTask(settings.preset, material, getStateInputSchema());
    }
    function clearSwipeRecovery() { swipeRecovery?.disconnect(); swipeRecovery = null; }
    function watchSwipeRecovery(id) {
        clearSwipeRecovery();
        if (!enabled() || readSettings().mode === 'off') return;
        const message = getContext().chat[Number(id)];
        if (!Array.isArray(message?.swipes) || message.swipe_id !== message.swipes.length) return;
        // ST restores a failed/aborted new swipe without another rendered/swiped
        // event: 1.18 replaces floors; 1.14 rewrites swipeid. Observe only that
        // pending transition, not streaming text or our own controls.
        swipeRecovery = new MutationObserver(() => {
            if (message.swipe_id !== message.swipes.length) clearSwipeRecovery();
            refresh();
        });
        const chat = document.getElementById('chat');
        const floor = chat?.querySelector(`.mes[mesid="${Number(id)}"]`);
        if (chat) swipeRecovery.observe(chat, { childList: true });
        if (floor) swipeRecovery.observe(floor, { attributes: true, attributeFilter: ['swipeid'] });
    }
    function refresh() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            view.refresh();
            if (!enabled()) { clearSwipeRecovery(); controller.invalidate(); document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove()); return; }
            if (readSettings().mode === 'off') clearSwipeRecovery();
            try { view.mountControls(latestReply(), controller.status(), readSettings().mode); }
            catch { document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove()); }
        });
    }
    const controller = createUpdateController({ context: getContext, stateApi, assemble, request: requestUpdate,
        settings: readSettings, assertAvailable, changed: refresh });
    const api = {
        settings: readSettings, saveSettings(value) { saveSettings(value); if (value.mode === 'off') controller.cancel(); refresh(); },
        async preview(settings) {
            const ctx = getContext(), target = latestReply(ctx), turn = stateApi.observeTurn(target);
            const task = await assemble(ctx, target, settings);
            turn.assertCurrent(); return task;
        },
        async openAssistant() {
            const { openCardWorkspace } = await import('../../assistant/assistant.js');
            await openCardWorkspace({ variables: true });
        },
        update: () => controller.update(), cancel: controller.cancel, retrySave: controller.retrySave, status: controller.status, result: controller.result,
    };
    const view = createUpdaterView(api);
    const cancelled = () => { pendingGeneration = null; controller.invalidate(); refresh(); };
    async function loadChat() {
        clearSwipeRecovery();
        cancelled();
        const ctx = getContext();
        if (removeLegacyResults(ctx.chat)) await ctx.saveChat();
    }
    events.on(event_types.GENERATION_STARTED, (type, _options, dryRun) => {
        if (dryRun || !['normal', 'regenerate', 'swipe', 'continue', undefined, ''].includes(type)) return;
        if (type !== 'swipe') clearSwipeRecovery();
        cancelled();
        const chat = getContext().chat;
        pendingGeneration = { chat, replacement: type === 'regenerate' && !chat.at(-1)?.is_user ? chat.at(-1) : null, length: chat.length };
    });
    events.on(event_types.MESSAGE_RECEIVED, id => {
        clearSwipeRecovery();
        if (pendingGeneration?.chat === getContext().chat) pendingGeneration.message = getContext().chat[Number(id)];
        refresh();
    });
    events.on(event_types.MESSAGE_DELETED, () => {
        clearSwipeRecovery();
        const chat = getContext().chat;
        // Regenerate first deletes its old reply. This is part of the same
        // generation, not a user cancellation; consume this exception once.
        if (pendingGeneration?.chat === chat && pendingGeneration.replacement
            && chat.length === pendingGeneration.length - 1 && !chat.includes(pendingGeneration.replacement)) {
            pendingGeneration.replacement = null;
            refresh();
        } else cancelled();
    });
    events.on(event_types.CHAT_CHANGED, loadChat);
    events.on(event_types.MESSAGE_SWIPED, id => { cancelled(); watchSwipeRecovery(id); });
    for (const event of [event_types.MESSAGE_SWIPE_DELETED, event_types.MESSAGE_UPDATED]) events.on(event, () => { clearSwipeRecovery(); cancelled(); });
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
        dispose() { events.cleanup(); clearSwipeRecovery(); controller.dispose(); cancelAnimationFrame(frame); view.dispose(); },
    };
    observeBackgroundTask(loadChat(), { source: import.meta.url, operation: 'retireLegacyResults' });
}

export function openVariableSettings(page) {
    if (!runtime) throw new Error(COPY.enable);
    runtime.open(page);
}
export function notifyVariableReplyReady(id) { runtime?.replyReady(id); }
export function cleanupVariableUpdater() { runtime?.dispose(); runtime = null; }
