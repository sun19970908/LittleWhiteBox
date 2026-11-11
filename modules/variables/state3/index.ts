import { createModuleEvents, event_types } from '../../../core/event-manager.js';
import { observeBackgroundTask } from '../../../shared/common/async-errors.js';
import { mergeAbortSignals } from '../../../shared/common/abort-utils.js';
import { isGenerating } from '../../../shared/common/sillytavern-generation-state.js';
import { waitForAfterAiReady } from '../../../core/after-ai-gate.js';
import { createSettlementService } from './runtime/service.js';
import { createHostAdapter, state3Context as getContext, inGroup, latestUserIndex, type ChatMessage } from './runtime/host.js';
import { compileDefinition } from './definition/compile.js';
import { initialize, settle } from './engine/settle.js';
import { diagnostic, reject } from './engine/diagnostics.js';
import { receiptResult } from './runtime/history.js';
import { openDraft, saveDraft, checkDraft, saveCardDraft, exportRules, prepareRuleImport, importRules } from './definition/authoring.js';
import { onRulesSaved } from './definition/card-host.js';
import { createState3Page } from './ui/settings.js';
import { notifyError } from './ui/notifications.js';
import { CHAT_KEY, CARD_EXTENSION } from './definition/format.js';
import { createState3Macros } from './model/macros.js';
import { createState3Updater } from './model/updater.js';
import { createBeforeGeneration } from './runtime/before-generation.js';
import { digest } from './definition/digest.js';
import { readSettings, saveSettings, state3Selected, selectState3 } from './runtime/settings.js';
export { state3Selected } from './runtime/settings.js';
import type { Result, RunOptions, Success } from './types.js';
import type { State3Api } from './runtime/api.js';

let runtime: { page: ReturnType<typeof createState3Page>; modeChanged(): void; dispose(): void } | undefined;

export function initState3() {
    if (runtime) {return;}
    const events = createModuleEvents('variables3'), macros = createState3Macros();
    let lastResult: Result | undefined, page: ReturnType<typeof createState3Page> | undefined;
    let resultMessage: ChatMessage | undefined;
    let beforeResult: Success | undefined;
    let swipeRecovery: MutationObserver | undefined;
    let pendingGeneration: { chat: ChatMessage[]; message?: ChatMessage } | undefined;
    let lifecycle = new AbortController(), selectedMode = state3Selected();
    let resultSequence = 0;
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
    function available() { lifecycle.signal.throwIfAborted(); if (!state3Selected()) {reject('not-enabled');} if (isGenerating()) {reject('commit-busy');} }
    const owned = <T extends RunOptions>(options?: T) => ({ ...options, signal: mergeAbortSignals(lifecycle.signal, options?.signal)! });
    async function syncProjection() {
        if (lifecycle.signal.aborted) {return;}
        if (!state3Selected() || inGroup(getContext())) { macros.clear(); return; }
        try {
            const epoch = lifecycle;
            macros.clear();
            const result = await service.inspect();
            if (epoch !== lifecycle || epoch.signal.aborted) {return;}
            if (!result.ok) { macros.clear(); return; }
            macros.set(compileDefinition(result.bundle));
        } catch (error) {
            if (['chat-missing', 'character-missing'].includes(diagnostic(error).code)) { macros.clear(); return; }
            throw error;
        }
    }
    const retain = async (promise: Promise<Result>, index?: number): Promise<Result> => {
        const epoch = lifecycle, sequence = ++resultSequence;
        const current = () => epoch === lifecycle && !epoch.signal.aborted && sequence === resultSequence;
        const ctx = getContext(), target = index === undefined ? [...ctx.chat].reverse().find(message => !message.is_user && !message.is_system) : ctx.chat[index];
        let result: Result;
        try { result = await promise; }
        catch (error) { result = { ok: false, diagnostics: [diagnostic(error)] }; }
        if (current()) {
            lastResult = result; resultMessage = target; await syncProjection();
            if (!current()) {return result;}
            if (result.ok && result.receipt?.beforeUpdate) {beforeResult = result;}
            refresh();
            if (result.ok && result.committed) {document.dispatchEvent(new CustomEvent('lwb:state3:committed', { detail: structuredClone(result) }));}
        }
        return result;
    };
    // Every rule writeback, through CardFiles or this API, refreshes the description macros before it resolves.
    const stopRulesSaved = onRulesSaved(() => { updater.cancel(); return report(syncProjection().then(refresh)); });
    const updater = createState3Updater({ service, adapter, available, changed: () => refresh() });
    const before = createBeforeGeneration({ adapter, service, updater, retain, refresh, report });
    const api: State3Api = {
        stage(options) { available(); return service.stage(owned(options)); },
        apply(input, options) { available(); return retain(service.apply(input, owned(options)), options?.index); },
        preview(input, options) { available(); return retain(service.preview(input, owned(options)), options?.index); },
        undo(options) { available(); return retain(service.undo(owned(options)), options?.index); },
        inspect: () => service.inspect(),
        async enable(options) {
            lifecycle.signal.throwIfAborted();
            if (isGenerating()) {reject('commit-busy');}
            const epoch = lifecycle;
            return retain((async () => {
                const result = await service.enable(owned(options));
                if (result.ok && result.committed && epoch === lifecycle && !epoch.signal.aborted) { selectState3(); selectedMode = true; }
                return result;
            })());
        },
        async tryDefinition(bundle, input = [], { state, signal, stage } = {}) {
            try {
                const compiled = compileDefinition(bundle);
                if (state !== undefined) {return settle(compiled, state, input, { signal, stage });}
                const initial = await initialize(compiled, { signal });
                return initial.ok ? settle(compiled, initial.state, input, { signal, stage }) : initial;
            } catch (error) { return { ok: false, diagnostics: [diagnostic(error)] }; }
        },
        openDraft, saveDraft, checkDraft, exportRules, prepareRuleImport,
        saveCardDraft, importRules,
        lastResult: () => lastResult,
        async retrySave() {
            const epoch = lifecycle, result = lastResult;
            const saved = await adapter.retrySave();
            if (epoch !== lifecycle || epoch.signal.aborted || lastResult !== result) {return saved;}
            if (result?.ok) {
                lastResult = { ...result, saved: true }; delete lastResult.persistence;
                if (beforeResult === result) {beforeResult = lastResult;}
            }
            refresh();
            if (result?.ok && result.receipt?.beforeUpdate && resultMessage) {await before.resume(getContext().chat.indexOf(resultMessage));}
            return saved;
        }, settings: readSettings, saveSettings,
        update: () => retain(updater.update(owned({ stage: 'after' as const }))),
        recomputeBefore: index => before.run(index), skipBefore: index => before.skip(index), undoBefore: index => before.undo(index),
        previewRequest: options => updater.previewRequest(owned(options)),
        cancel: () => before.cancel(), updateStatus: () => before.status(),
        async openAssistant() {
            const { openCardWorkspace } = await import('../../assistant/assistant.js');
            await openCardWorkspace({ variables: true, version: '3.0' });
        },
    };
    page = createState3Page(api);
    function refresh() {
        if (lifecycle.signal.aborted) {return;}
        if (!state3Selected() || inGroup(getContext())) { document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove()); return; }
        try {
            const snapshot = adapter.capture();
            if (!snapshot.history) { document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove()); return; }
            const ctx = getContext(), definition = adapter.bundle().definition, updates = definition.updates;
            const userIndex = latestUserIndex(ctx.chat);
            const beforeIndex = snapshot.history && updates.includes('before') && ctx.chat[userIndex]?.mes?.trim() ? userIndex : -1;
            const results = snapshot.records.flatMap((record, index) => {
                const receipt = record.entries.at(-1);
                return receipt && snapshot.history ? [{ index, result: (receipt.id === beforeResult?.receipt?.id ? beforeResult : receiptResult(snapshot.state, receipt)) as Result,
                    stage: ctx.chat[index]?.is_user ? 'before' as const : 'after' as const,
                    edited: Boolean(receipt.beforeUpdate && receipt.beforeUpdate.inputDigest !== digest(ctx.chat[index]?.mes)) }] : [];
            });
            const resultIndex = resultMessage ? getContext().chat.indexOf(resultMessage) : snapshot.index;
            if (lastResult && resultIndex >= 0) {
                const existing = results.find(item => item.index === resultIndex);
                if (existing) {existing.result = lastResult;} else {results.push({ index: resultIndex, result: lastResult,
                    stage: ctx.chat[resultIndex]?.is_user ? 'before' : 'after', edited: false });}
            }
            page?.mountControl(snapshot.index, results, { updates, beforeIndex, definition });
        }
        catch (error) { if (!['chat-missing', 'character-missing'].includes(diagnostic(error).code)) {throw error;} }
    }
    function changed() {
        clearSwipeRecovery(); pendingGeneration = undefined; lifecycle.abort(); lifecycle = new AbortController();
        before.changed(); macros.clear(); lastResult = undefined; resultMessage = undefined; beforeResult = undefined; adapter.remember();
        page?.targetChanged(); refresh(); observeBackgroundTask(report(syncProjection()), { source: import.meta.url, operation: 'projection' });
    }
    function modeChanged() { if (state3Selected() !== selectedMode) { selectedMode = state3Selected(); changed(); } else {refresh();} }
    function invalidateResult(keepBefore = false) {
        lifecycle.abort(); lifecycle = new AbortController();
        lastResult = undefined; resultMessage = undefined;
        // The before-generation owner handles generation cancellation/reuse.
        if (!keepBefore) {updater.cancel(); beforeResult = undefined;}
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
                const restored = await service.restoreSelection(change.previous, change.next, { check: change.historical, signal: lifecycle.signal });
                if (!restored) {reject('nothing-to-undo');}
                if (!restored.ok) {return restored;}
                const snapshot = adapter.capture(index);
                const receipt = snapshot.records[snapshot.index]?.entries.at(-1);
                return { ...restored, ...(receipt ? { receipt } : {}) };
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
        invalidateResult(true); adapter.remember(); pendingGeneration = { chat: getContext().chat };
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
            if (ctx.chatMetadata[CHAT_KEY] && readSettings().auto && adapter.bundle().definition.updates.includes('after')) {await api.update();}
            adapter.remember(); refresh();
        })()), { source: import.meta.url, operation: 'afterGeneration' });
    });
    events.on(event_types.CHAT_CREATED, async () => {
        const ctx = getContext();
        if (inGroup(ctx) || !state3Selected() || ctx.chatMetadata?.[CHAT_KEY]) {return;}
        if (ctx.characters?.[ctx.characterId]?.data?.extensions?.[CARD_EXTENSION]) {await api.enable({ signal: lifecycle.signal });}
    });
    window.LWB_StateV3 = api;
    runtime = { page, modeChanged, dispose() { stopRulesSaved(); lifecycle.abort(); clearSwipeRecovery(); topology.disconnect(); before.dispose(); macros.dispose(); events.cleanup(); page?.dispose(); delete window.LWB_StateV3; } };
    refresh();
    if (state3Selected()) {observeBackgroundTask(report(syncProjection()), { source: import.meta.url, operation: 'projection' });}
}
export async function openState3(page?: 'play' | 'author') {
    try { if (!runtime) {reject('not-enabled');} await runtime.page.open(page); }
    catch (error) { notifyError(error); }
}
export function syncState3Mode() { runtime?.modeChanged(); }
export function cleanupState3() { runtime?.dispose(); runtime = undefined; }
