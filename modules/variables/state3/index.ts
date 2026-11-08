import { createModuleEvents, event_types } from '../../../core/event-manager.js';
import { observeBackgroundTask } from '../../../shared/common/async-errors.js';
import { isGenerating } from '../../../shared/common/sillytavern-generation-state.js';
import { waitForAfterAiReady } from '../../../core/after-ai-gate.js';
import { createSettlementService } from './runtime/service.js';
import { createHostAdapter, state3Context as getContext, inGroup, type ChatMessage } from './runtime/host.js';
import { compileDefinition } from './definition/compile.js';
import { initialize, settle } from './engine/settle.js';
import { diagnostic, reject } from './engine/diagnostics.js';
import { receiptResult } from './runtime/history.js';
import { openDraft, saveDraft, checkDraft, saveCardDraft, exportRules, prepareRuleImport, importRules } from './definition/authoring.js';
import { createState3Page } from './ui/settings.js';
import { notifyError } from './ui/notifications.js';
import { CHAT_KEY, CARD_EXTENSION } from './definition/format.js';
import { createState3Macros } from './model/macros.js';
import { createState3Updater } from './model/updater.js';
import { readSettings, saveSettings, state3Selected, selectState3 } from './runtime/settings.js';
export { state3Selected } from './runtime/settings.js';
import type { Result } from './types.js';
import type { State3Api } from './runtime/api.js';

let runtime: { page: ReturnType<typeof createState3Page>; modeChanged(): void; dispose(): void } | undefined;

export function initState3() {
    if (runtime) {return;}
    const events = createModuleEvents('variables3'), macros = createState3Macros();
    let lastResult: Result | undefined, page: ReturnType<typeof createState3Page> | undefined;
    let resultMessage: ChatMessage | undefined;
    let swipeRecovery: MutationObserver | undefined;
    let pendingGeneration: { chat: ChatMessage[]; message?: ChatMessage } | undefined;
    let lifecycle = new AbortController(), selectedMode = state3Selected();
    const adapter = createHostAdapter();
    const topology = new MutationObserver(() => { if (adapter.rememberOrder()) {refresh();} });
    const chatElement = document.getElementById('chat');
    if (chatElement) {topology.observe(chatElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid'] });}
    const service = createSettlementService(adapter);
    const report = (promise: Promise<unknown>) => {
        const handled = promise.catch(notifyError);
        observeBackgroundTask(handled, { source: import.meta.url, operation: 'state3' });
        return handled;
    };
    function available() { if (!state3Selected()) {reject('not-enabled');} if (isGenerating()) {reject('commit-busy');} }
    async function syncProjection() {
        if (!state3Selected() || inGroup(getContext())) { macros.clear(); return; }
        try {
            const epoch = lifecycle;
            macros.clear();
            const result = await service.inspect();
            if (epoch !== lifecycle) {return;}
            if (!result.ok) { macros.clear(); return; }
            macros.set(compileDefinition(result.bundle));
        } catch (error) {
            if (['chat-missing', 'character-missing'].includes(diagnostic(error).code)) { macros.clear(); return; }
            throw error;
        }
    }
    const retain = async (promise: Promise<Result>, index?: number): Promise<Result> => {
        const epoch = lifecycle;
        const ctx = getContext(), target = index === undefined ? [...ctx.chat].reverse().find(message => !message.is_user && !message.is_system) : ctx.chat[index];
        let result: Result;
        try { result = await promise; }
        catch (error) { result = { ok: false, diagnostics: [diagnostic(error)] }; }
        if (epoch === lifecycle) {
            lastResult = result; resultMessage = target; await syncProjection(); refresh();
            if (result.ok && result.committed) {document.dispatchEvent(new CustomEvent('lwb:state3:committed', { detail: structuredClone(result) }));}
        }
        return result;
    };
    const updater = createState3Updater({ service, adapter, available, changed: () => refresh() });
    const api: State3Api = {
        stage(options) { available(); return service.stage(options); },
        apply(input, options) { available(); return retain(service.apply(input, options), options?.index); },
        preview(input, options) { available(); return retain(service.preview(input, options), options?.index); },
        undo(options) { available(); return retain(service.undo(options), options?.index); },
        inspect: () => service.inspect(),
        async enable(options) {
            if (isGenerating()) {reject('commit-busy');}
            const epoch = lifecycle;
            return retain((async () => {
                const result = await service.enable(options);
                if (result.ok && result.committed && epoch === lifecycle) { selectState3(); selectedMode = true; }
                return result;
            })());
        },
        async tryDefinition(bundle, input = [], { state, signal } = {}) {
            try {
                const compiled = compileDefinition(bundle);
                if (state !== undefined) {return settle(compiled, state, input, { signal });}
                const initial = await initialize(compiled, { signal });
                return initial.ok ? settle(compiled, initial.state, input, { signal }) : initial;
            } catch (error) { return { ok: false, diagnostics: [diagnostic(error)] }; }
        },
        openDraft, saveDraft, checkDraft, exportRules, prepareRuleImport,
        async saveCardDraft(draft) { const result = await saveCardDraft(draft); await report(syncProjection()); return result; },
        async importRules(prepared, options) { const result = await importRules(prepared, options); await syncProjection(); return result; },
        lastResult: () => lastResult,
        async retrySave() {
            const epoch = lifecycle, result = lastResult;
            const saved = await adapter.retrySave();
            if (epoch === lifecycle && lastResult === result && result?.ok) { lastResult = { ...result, saved: true }; delete lastResult.persistence; }
            refresh(); return saved;
        }, settings: readSettings, saveSettings,
        update: () => retain(updater.update()), previewRequest: options => updater.previewRequest(options),
        cancel: () => updater.cancel(), updateStatus: () => updater.status(),
        async openAssistant() {
            const { openCardWorkspace } = await import('../../assistant/assistant.js');
            await openCardWorkspace({ variables: true, version: '3.0' });
        },
    };
    page = createState3Page(api);
    function refresh() {
        if (!state3Selected() || inGroup(getContext())) { document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove()); return; }
        try {
            const snapshot = adapter.capture();
            const results = snapshot.records.flatMap((record, index) => {
                const receipt = record.entries.at(-1);
                return receipt && snapshot.history ? [{ index, result: receiptResult(snapshot.state, receipt) as Result }] : [];
            });
            const resultIndex = resultMessage ? getContext().chat.indexOf(resultMessage) : snapshot.index;
            if (lastResult && resultIndex >= 0) {
                const existing = results.find(item => item.index === resultIndex);
                if (existing) {existing.result = lastResult;} else {results.push({ index: resultIndex, result: lastResult });}
            }
            page?.mountControl(snapshot.index, results);
        }
        catch (error) { if (!['chat-missing', 'character-missing'].includes(diagnostic(error).code)) {throw error;} }
    }
    function changed() {
        clearSwipeRecovery(); pendingGeneration = undefined; lifecycle.abort(); lifecycle = new AbortController();
        updater.cancel(); macros.clear(); lastResult = undefined; resultMessage = undefined; adapter.remember();
        page?.targetChanged(); refresh(); observeBackgroundTask(report(syncProjection()), { source: import.meta.url, operation: 'projection' });
    }
    function modeChanged() { if (state3Selected() !== selectedMode) { selectedMode = state3Selected(); changed(); } else {refresh();} }
    function invalidateResult() {
        lifecycle.abort(); lifecycle = new AbortController();
        updater.cancel(); lastResult = undefined; resultMessage = undefined;
        page?.targetChanged();
    }
    function clearSwipeRecovery() { swipeRecovery?.disconnect(); swipeRecovery = undefined; }
    function watchSwipeRecovery(index: number) {
        clearSwipeRecovery();
        if (!state3Selected()) {return;}
        const ctx = getContext(), message = ctx.chat[index];
        if (!message?.swipes || message.swipe_id !== message.swipes.length) {return;}
        const pendingSwipe = message.swipe_id;
        swipeRecovery = new MutationObserver(() => {
            if (getContext().chat !== ctx.chat) {clearSwipeRecovery(); return;}
            if (message.swipe_id === message.swipes!.length) {return;}
            clearSwipeRecovery();
            if (message.swipe_id === pendingSwipe) {refresh(); return;}
            pendingGeneration = undefined;
            observeBackgroundTask(report(restoreSelection('swipe', ctx.chat.indexOf(message))), { source: import.meta.url, operation: 'swipe-recovery' });
        });
        const chat = document.getElementById('chat'), floor = chat?.querySelector(`.mes[mesid="${index}"]`);
        if (chat) {swipeRecovery.observe(chat, { childList: true });}
        if (floor) {swipeRecovery.observe(floor, { attributes: true, attributeFilter: ['swipeid'] });}
    }
    async function restoreSelection(kind: 'delete' | 'swipe', index?: number) {
        const change = adapter.selectionChange(kind, index);
        if (!state3Selected()) {return;}
        invalidateResult();
        if (change.previous.length || change.next.length) {
            // Restore before yielding, but never hold the native swipe event on
            // disk I/O. retain owns save failures and ignores obsolete selections.
            observeBackgroundTask(report(retain((async () => {
                const restored = await service.restoreSelection(change.previous, change.next);
                if (!restored) {reject('nothing-to-undo');}
                if (!restored.ok) {return restored;}
                const snapshot = adapter.capture(index);
                const receipt = snapshot.records[snapshot.index]?.entries.at(-1);
                return { ...(receipt ? receiptResult(snapshot.state, receipt) : { ...restored, changes: [] }), saved: restored.saved, persistence: restored.persistence };
            })(), index)), { source: import.meta.url, operation: 'selection-save' });
            await syncProjection();
        }
        refresh();
    }
    events.on(event_types.CHAT_CHANGED, changed);
    events.on(event_types.MESSAGE_DELETED, () => { clearSwipeRecovery(); return report(restoreSelection('delete')); });
    events.on(event_types.MESSAGE_SWIPED, (index: number) => {
        const restoring = report(restoreSelection('swipe', Number(index)));
        watchSwipeRecovery(Number(index));
        return restoring;
    });
    events.on(event_types.MESSAGE_EDITED, () => { clearSwipeRecovery(); invalidateResult(); refresh(); });
    // The host emits MESSAGE_SWIPED after deleting the selected swipe; that event owns restoration.
    events.on(event_types.SETTINGS_UPDATED, modeChanged);
    events.on(event_types.CHARACTER_MESSAGE_RENDERED, refresh);
    events.on(event_types.GENERATION_STARTED, (type: string, _options: unknown, dryRun: boolean) => {
        if (dryRun) {return syncProjection();}
        if (!state3Selected() || !['normal', 'regenerate', 'swipe', 'continue', undefined, ''].includes(type)) {return;}
        invalidateResult(); adapter.remember(); pendingGeneration = { chat: getContext().chat };
        return syncProjection();
    });
    events.on(event_types.MESSAGE_RECEIVED, (index: number) => {
        if (pendingGeneration && pendingGeneration.chat === getContext().chat) {pendingGeneration.message = getContext().chat[Number(index)];}
    });
    events.on(event_types.GENERATION_ENDED, () => {
        if (!state3Selected() || !pendingGeneration) {return;}
        const generation = pendingGeneration, signal = lifecycle.signal, chatId = String(getContext().chatId);
        observeBackgroundTask(report((async () => {
            if (!await waitForAfterAiReady(chatId, signal) || pendingGeneration !== generation) {return;}
            const ctx = getContext(), message = generation.message;
            if (ctx.chat !== generation.chat || !message || !state3Selected()) {return;}
            const messageId = ctx.chat.indexOf(message);
            if (messageId < 0) {return;}
            pendingGeneration = undefined;
            const blocks = [...String(message.mes || '').matchAll(/<state3>\s*([\s\S]*?)\s*<\/state3>/g)];
            if (blocks.length) {
                await retain((async () => {
                    const input = blocks.flatMap(match => { const value: unknown = JSON.parse(match[1]); if (!Array.isArray(value)) {reject('input-shape');} return value; });
                    return service.apply(input, { index: messageId, replaceSource: 'body', source: 'body', signal });
                })(), messageId);
            } else if (readSettings().mode === 'auto') {await api.update();}
            adapter.remember(); refresh();
        })()), { source: import.meta.url, operation: 'afterGeneration' });
    });
    events.on(event_types.CHAT_CREATED, async () => {
        const ctx = getContext();
        if (inGroup(ctx) || !state3Selected() || ctx.chatMetadata?.[CHAT_KEY]) {return;}
        if (ctx.characters?.[ctx.characterId]?.data?.extensions?.[CARD_EXTENSION]) {await api.enable({ signal: lifecycle.signal });}
    });
    window.LWB_StateV3 = api;
    runtime = { page, modeChanged, dispose() { lifecycle.abort(); clearSwipeRecovery(); topology.disconnect(); updater.cancel(); macros.dispose(); events.cleanup(); page?.dispose(); delete window.LWB_StateV3; } };
    refresh();
    if (state3Selected()) {observeBackgroundTask(report(syncProjection()), { source: import.meta.url, operation: 'projection' });}
}
export async function openState3(page?: 'play' | 'author') { if (!runtime) {reject('not-enabled');} return runtime.page.open(page); }
export function syncState3Mode() { runtime?.modeChanged(); }
export function cleanupState3() { runtime?.dispose(); runtime = undefined; }
