import { Generate, setExtensionPrompt, extension_prompt_types, extension_prompt_roles } from '../../../../../../../../script.js';
import { createModuleEvents, event_types } from '../../../../core/event-manager.js';
import { registerGenerateInterceptor, unregisterGenerateInterceptor, GENERATE_INTERCEPTOR_ORDER } from '../../../../shared/common/generate-interceptor.js';
import { isGenerating } from '../../../../shared/common/sillytavern-generation-state.js';
import { observeBackgroundTask } from '../../../../shared/common/async-errors.js';
import { state3Context as getContext, inGroup, latestUserIndex, type ChatMessage, type createHostAdapter } from './host.js';
import { state3Selected } from './settings.js';
import { CHAT_KEY } from '../definition/format.js';
import { digest } from '../definition/digest.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { beforeReceipt, beforeFloorOutcome } from './before-result.js';
import { beforeProsePrompt } from '../model/prompts.js';
import type { createState3Updater } from '../model/updater.js';
import type { SettlementService } from './service.js';
import type { BeforeUpdate, Result } from '../types.js';

const ID = 'variables-before';
interface Dispatch { input: { deferred: boolean; rebuild: boolean } }
interface Dependencies {
    adapter: ReturnType<typeof createHostAdapter>; service: SettlementService; updater: ReturnType<typeof createState3Updater>;
    retain(result: Promise<Result>, index?: number): Promise<Result>; refresh(): void; report(promise: Promise<unknown>): unknown;
    ready?(): boolean;
}

/** Owns only the current handoff to prose. Durable outcomes belong to USER receipts. */
export function createBeforeGeneration({ adapter, service, updater, retain, refresh, report, ready = () => true }: Dependencies) {
    const events = createModuleEvents(ID);
    let candidate: ChatMessage | undefined, eligible = false, generation = 0;
    let active: { controller: AbortController; message: ChatMessage; chatId: string; finished: Promise<void> } | undefined;
    const clearPrompt = () => setExtensionPrompt(ID, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
    const enabled = () => state3Selected() && !inGroup(getContext()) && Boolean(getContext().chatMetadata[CHAT_KEY]);
    const latestUser = () => latestUserIndex(getContext().chat);
    const receiptAt = (index: number) => beforeReceipt(adapter.capture(index).records[index]);
    const supportsBefore = () => enabled() && adapter.bundle().definition.updates.includes('before');
    function interrupt() { generation++; active?.controller.abort(); updater.interrupt(); }
    function cancel() { interrupt(); updater.cancel(); }
    function changed() { cancel(); candidate = undefined; eligible = false; clearPrompt(); }
    async function waitForIdle(signal: AbortSignal) {
        while (isGenerating()) { signal.throwIfAborted(); await new Promise(resolve => setTimeout(resolve, 25)); }
        signal.throwIfAborted();
    }
    function assertTarget(index: number) {
        if (!ready()) {reject('commit-busy');}
        if (!supportsBefore()) {reject('stage-disabled', { stage: 'before' });}
        if (index !== latestUser() || !getContext().chat[index]?.mes?.trim()) {reject('target-missing');}
    }
    async function resume(index: number) {
        const ctx = getContext(), receipt = receiptAt(index);
        if (!enabled() || active || isGenerating() || ctx.chat[index] !== ctx.chat.at(-1)
            || !receipt?.beforeUpdate || receipt.beforeUpdate.outcome === 'failed') {return;}
        candidate = ctx.chat[index];
        await Generate('regenerate');
    }
    async function run(index: number, autoResume: boolean) {
        assertTarget(index);
        if (active || updater.status().busy) {reject('commit-busy');}
        let finish!: () => void;
        const finished = new Promise<void>(resolve => {finish = resolve;});
        const ctx = getContext(), message = ctx.chat[index], own = { controller: new AbortController(), message, chatId: ctx.chatId, finished };
        active = own; refresh();
        const { signal } = own.controller, inputDigest = digest(message.mes);
        const current = () => active === own && !signal.aborted && getContext().chatId === own.chatId
            && getContext().chat[index] === message && digest(message.mes) === inputDigest && supportsBefore();
        let result: Result | undefined;
        try {
            await waitForIdle(signal);
            if (!current()) {return;}
            result = await retain(updater.update({ index, stage: 'before', signal }), index);
            if (!current()) {return;}
            const previous = receiptAt(index)?.beforeUpdate;
            if (!result.ok && updater.status().retryIndex !== index && (!previous || previous.outcome === 'failed')) {
                // Failure is recorded on the already-rolled-back state. Never
                // restore a superseded USER/AI settlement when recomputation fails.
                const extensions = result.extensions;
                result = await retain(service.recordBefore(index, { inputDigest, outcome: 'failed', diagnostics: result.diagnostics }, { signal })
                    .then(recorded => extensions ? { ...recorded, extensions } : recorded), index);
            }
        } finally {
            finish();
            if (active === own) {active = undefined; refresh();}
        }
        if (!signal.aborted && result?.ok && result.saved !== false && result.receipt?.beforeUpdate?.outcome !== 'failed' && autoResume) {await resume(index);}
        return result;
    }
    async function record(index: number, outcome: BeforeUpdate['outcome']) {
        assertTarget(index);
        if (active || updater.status().busy || isGenerating()) {reject('commit-busy');}
        const result = await retain(service.recordBefore(index, { inputDigest: digest(getContext().chat[index].mes), outcome, diagnostics: [] }), index);
        if (result.ok && result.saved !== false && outcome === 'skipped') {await resume(index);}
        return result;
    }
    async function intercept(_chat: unknown, _size: number, abort: (immediately: boolean) => void, type: string, dispatch: Dispatch) {
        clearPrompt();
        if (!state3Selected() || ['quiet', 'impersonate'].includes(type)) {return;}
        try {
            if (!ready()) {reject('opening-start-required');}
            if (!enabled()) {return;}
            if (!supportsBefore()) {return;}
            const index = latestUser(), ctx = getContext(), message = ctx.chat[index];
            if (!message) {return;}
            if (dispatch.input.deferred) {dispatch.input.rebuild = true; return;}
            const receipt = receiptAt(index);
            if (receipt?.beforeUpdate) {
                if (receipt.beforeUpdate.outcome === 'failed') {if (eligible) {abort(true); refresh();} return;}
                const outcome = beforeFloorOutcome(adapter.capture(index), index)!;
                if (outcome.outcome === 'rejected' || outcome.outcome === 'applied' && (outcome.actions.length || outcome.changes.length)) {
                    setExtensionPrompt(ID, beforeProsePrompt(outcome), extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
                }
                return;
            }
            if (!eligible || !['normal', 'regenerate', '', undefined].includes(type) || ctx.chat.at(-1) !== message
                || (candidate !== message && type !== 'regenerate') || !message.mes?.trim()) {return;}
            abort(true);
            // A new player turn cancels the old request. Wait for that owner to
            // release the updater; only the newest generation may take it next.
            const turn = generation, previous = active?.finished;
            observeBackgroundTask(Promise.resolve(report((async () => {
                await previous;
                if (turn === generation && getContext().chat.at(-1) === message && enabled()) {await run(index, true);}
            })())), { source: import.meta.url, operation: 'before' });
        } catch (error) {
            abort(true);
            const index = latestUser();
            await retain(Promise.resolve({ ok: false, diagnostics: [diagnostic(error)] }), index);
        }
    }
    events.on(event_types.GENERATION_STARTED, (type: string, _options: unknown, dryRun: boolean) => {
        if (!dryRun) {
            const index = latestUser(), ctx = getContext();
            // Regenerating the same unfinished player turn resumes its paid input.
            // New messages and other generation modes discard it; retryIndex checks its basis.
            if (type === 'regenerate' && ctx.chat[index] === ctx.chat.at(-1) && updater.status().retryIndex === index) {interrupt();}
            else {cancel();}
            clearPrompt(); eligible = false;
        }
    });
    events.on(event_types.GENERATION_AFTER_COMMANDS, (type: string, options: { automatic_trigger?: boolean }, dryRun: boolean) => {
        if (!dryRun) {
            const text = (document.getElementById('send_textarea') as HTMLTextAreaElement | null)?.value.trim();
            eligible = !options?.automatic_trigger && (type === 'regenerate' || Boolean(text) && ['normal', undefined, ''].includes(type));
        }
    });
    events.on(event_types.MESSAGE_SENT, (index: number) => { if (eligible && isGenerating()) {candidate = getContext().chat[Number(index)];} });
    events.on(event_types.GENERATION_STOPPED, () => { cancel(); clearPrompt(); });
    events.on(event_types.GENERATION_ENDED, clearPrompt);
    events.on(event_types.CHAT_CHANGED, changed);
    events.on(event_types.MESSAGE_EDITED, () => { cancel(); clearPrompt(); refresh(); });
    events.on(event_types.MESSAGE_DELETED, () => { if (active && !getContext().chat.includes(active.message)) {cancel();} clearPrompt(); });
    registerGenerateInterceptor(ID, intercept, GENERATE_INTERCEPTOR_ORDER.VARIABLES);
    return {
        run: (index: number) => run(index, getContext().chat[index] === getContext().chat.at(-1)),
        skip: (index: number) => record(index, 'skipped'), undo: (index: number) => record(index, 'undone'),
        resume, cancel, changed,
        status: () => active ? { ...updater.status(), busy: true, phase: updater.status().busy ? updater.status().phase : 'preparing', index: getContext().chat.indexOf(active.message) } : updater.status(),
        dispose() { changed(); events.cleanup(); unregisterGenerateInterceptor(ID); },
    };
}
