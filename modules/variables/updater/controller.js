import { fingerprint } from '../state2/records.js';
import { latestReply, hasBodyUpdate } from './context.js';
import { COPY } from './copy.js';
import { saveUpdate } from './persistence.js';
import { StateInputError } from '../state2/json-input.js';
import { SubmissionError } from './transport.js';
import { correctionTask } from './correction.js';

export const RECEIPT_KEY = 'LittleWhiteBox_variableUpdate';

export function createUpdateController({ context, stateApi, assemble, request, settings, assertAvailable, changed }) {
    let active = null;
    let last = null;
    const identity = ctx => JSON.stringify([ctx.chatId, ctx.characterId, ctx.groupId]);
    function current(run) {
        const ctx = context();
        return ctx.chat === run.ctx.chat && identity(ctx) === run.identity
            && ctx.chat[run.target.floor] === run.target.message && run.target.message.mes === run.body
            && ctx.chat.slice(run.target.floor + 1).every(message => message.is_user === true && !message.is_system)
            && (run.target.message.swipe_id ?? 0) === run.target.swipeId;
    }
    function change(run, phase, error = '') { Object.assign(run, { phase, error }); changed(); }
    const cancel = () => { active?.abort.abort(); };
    async function update() {
        if (active) throw new Error(COPY.busy);
        assertAvailable();
        const ctx = context(), target = latestReply(ctx);
        const run = { ctx, target, identity: identity(ctx), body: target.message.mes, phase: 'preparing', abort: new AbortController() };
        active = last = run;
        changed();
        try {
            const turn = stateApi.stageTurn(target);
            const config = settings();
            run.task = await assemble(ctx, target, turn.snapshot, config, run.abort.signal);
            run.abort.signal.throwIfAborted(); turn.assertCurrent();
            let task = run.task;
            for (let attempt = 0; attempt < 2; attempt++) {
                run.abort.signal.throwIfAborted(); turn.assertCurrent(); assertAvailable();
                change(run, attempt ? 'correcting' : 'requesting');
                let errors, reply;
                try {
                    run.input = await request(task, config.source, run.abort.signal, response => { reply = response; });
                    run.abort.signal.throwIfAborted(); turn.assertCurrent(); assertAvailable();
                    run.result = turn.commit(run.input);
                    if (!run.result.errors.length) break;
                    errors = run.result.errors.map(error => error.message);
                } catch (error) {
                    if (!(error instanceof StateInputError) && !(error instanceof SubmissionError)) throw error;
                    errors = [error.message];
                }
                if (attempt === 1) throw new Error(errors.join('\n'));
                task = correctionTask(run.task, reply ?? { state: run.input }, errors);
            }
            const receipt = { v: 1, at: Date.now(), body: fingerprint(run.body), source: config.source,
                changes: run.result.changes, corrections: run.result.corrections };
            target.message.extra ||= {};
            target.message.extra[RECEIPT_KEY] = receipt;
            const swipe = target.message.swipe_info?.[target.swipeId];
            if (swipe) { swipe.extra ||= {}; swipe.extra[RECEIPT_KEY] = structuredClone(receipt); }
            change(run, 'saving');
            try { await saveUpdate(ctx, target, run.abort.signal); }
            catch (error) { run.saveFailed = true; throw new Error(`${COPY.failedSave}\n${error.message}`); }
            change(run, run.result.changes.length ? 'success' : 'noop');
        } catch (error) {
            change(run, run.abort.signal.aborted ? 'cancelled' : 'failed', run.abort.signal.aborted ? '' : error.message);
        } finally {
            if (active === run) active = null;
            changed();
        }
    }
    async function retrySave() {
        if (!last?.saveFailed || !current(last)) throw new Error(COPY.stale);
        await saveUpdate(context(), last.target);
        last.saveFailed = false;
        change(last, last.result.changes.length ? 'success' : 'noop');
    }
    function status() {
        if (last && current(last)) return { phase: last.phase, error: last.error, result: last.result, input: last.input,
            busy: active === last, saveFailed: last.saveFailed };
        let target;
        try { target = latestReply(context()); } catch { return { phase: 'ready' }; }
        const receipt = target.message.extra?.[RECEIPT_KEY];
        return receipt?.body === fingerprint(target.message.mes)
            ? { phase: receipt.changes.length ? 'success' : 'noop', result: receipt } : { phase: hasBodyUpdate(target.message) ? 'body' : 'ready' };
    }
    return { update, cancel, retrySave, status, dispose: cancel };
}
