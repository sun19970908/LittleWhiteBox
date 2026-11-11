import type { PublicAgentSession, AgentChatResult } from '../../../agent-core/public-api.js';
import { correctionTask } from '../../updater/correction.js';
import type { Result, RunOptions, UpdateStage } from '../types.js';
import type { SettlementService } from '../runtime/service.js';
import { state3Context as getContext, latestUserIndex, type createHostAdapter } from '../runtime/host.js';
import { exposeVariableReads } from '../../var-commands.js';
import { captureContext } from '../../shared/context-capture.js';
import { passageText } from '../../shared/passage.js';
import { compileDefinition } from '../definition/compile.js';
import { buildUpdateTask } from './prompts.js';
import { SUBMIT_TOOL } from './tools.js';
import { readSettings } from '../runtime/settings.js';
import { reject, diagnostic } from '../engine/diagnostics.js';
import { modelSource } from '../definition/stages.js';
import { digest } from '../definition/digest.js';
import { beforeOutcome, beforeReceipt } from '../runtime/before-result.js';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';

export function parseSubmission(response: AgentChatResult): unknown[] {
    if (response.truncated || response.completion !== 'complete') {reject('model-submission', { completion: response.completion, truncated: response.truncated, response: response.text });}
    if (response.toolCalls?.length !== 1 || response.toolCalls[0].name !== SUBMIT_TOOL) {reject('model-submission', { response: response.text });}
    let args;
    try { args = JSON.parse(response.toolCalls[0].arguments); } catch { reject('model-submission'); }
    if (!args || Object.keys(args).length !== 1 || !Array.isArray(args.state)) {reject('model-submission');}
    return args.state;
}

export function createState3Updater({ service, adapter, available, changed }: { service: SettlementService; adapter: ReturnType<typeof createHostAdapter>; available(): void; changed?(): void }) {
    let controller: AbortController | undefined, phase = 'ready', activeIndex: number | undefined;
    // One retry slot, not a history/cache. No session, prompt, Worker or full
    // snapshot survives an update. Only submitted input and its basis identity do.
    let pending: { input: unknown[]; stage: UpdateStage; index: number; basis: string } | undefined;
    const environmentFailure = (result: Result) => !result.ok && result.diagnostics.length > 0 && result.diagnostics.every(issue =>
        ['function_startup_failed', 'function_worker_error', 'function_worker_unresponsive', 'function_message_error'].includes(issue.code));
    const correctable = (result: Result) => !result.ok && result.diagnostics.every(issue => [
        'model-submission', 'input-shape', 'input-number', 'path', 'missing-parent', 'array-index', 'action-missing', 'action-parameters',
        'action-precondition', 'stage-permission', 'permission', 'derived-write', 'state-schema', 'constraint', 'increment-target', 'increment-overflow',
    ].includes(issue.code));
    function retryIndex() {
        if (pending && adapter.submissionBasis(pending.index) !== pending.basis) {pending = undefined;}
        return pending?.index;
    }
    const setPhase = (value: string) => { phase = value; changed?.(); };
    const interrupt = () => { controller?.abort(); };
    const cancel = () => { pending = undefined; interrupt(); };
    async function prepare(stage: UpdateStage, index?: number, signal?: AbortSignal) {
        available();
        const staged = await service.stage({ index, replaceSource: modelSource(stage), signal });
        const ctx = getContext(), message = ctx.chat[staged.target.floor];
        if (!message || Boolean(message.is_user) !== (stage === 'before') || message.is_system || !message.mes?.trim()) {reject('target-missing');}
        const snapshot = adapter.capture(staged.target.floor);
        const compiled = compileDefinition(staged.bundle);
        if (!compiled.definition.updates.includes(stage)) {reject('stage-disabled', { stage });}
        const inputDigest = digest(message.mes);
        const userIndex = latestUserIndex(ctx.chat, staged.target.floor);
        const prior = stage === 'after' ? beforeReceipt(snapshot.records[userIndex]) : undefined;
        const preceding = prior?.beforeUpdate ? { beforeUpdate: beforeOutcome(prior) } : {};
        const reservation = buildUpdateTask(compiled, staged.snapshot, { target: staged.target, messages: [], ...preceding }, stage);
        const context = await captureContext(ctx, { ...staged.target, message }, reservation,
            passageText, signal,
            () => exposeVariableReads(staged.snapshot, staged.roots));
        staged.assertCurrent();
        if (!adapter.isCurrent(snapshot)) {reject('stale-target');}
        return { staged, inputDigest, task: buildUpdateTask(compiled, staged.snapshot, { ...context, ...preceding }, stage) };
    }
    return {
        cancel, interrupt,
        status: () => ({ phase, busy: Boolean(controller), index: activeIndex, retryIndex: retryIndex() }),
        async previewRequest({ signal, stage = 'after', index }: RunOptions & { index?: number } = {}) {
            if (stage === 'before' && index === undefined) {index = latestUserIndex(getContext().chat);}
            const prepared = await prepare(stage, index, signal);
            return prepared.task;
        },
        async update({ stage = 'after', index, signal: outerSignal }: RunOptions & { index?: number } = {}): Promise<Result> {
            if (controller) {reject('commit-busy');}
            const own = new AbortController(); controller = own; activeIndex = index;
            const signal = mergeAbortSignals(own.signal, outerSignal)!;
            let session: PublicAgentSession | undefined;
            try {
                setPhase('preparing');
                available();
                const target = index ?? (stage === 'before' ? latestUserIndex(getContext().chat) : adapter.capture().index);
                const retry = retryIndex() === target && pending?.stage === stage ? pending : undefined;
                pending = undefined;
                const finish = async (staged: Awaited<ReturnType<SettlementService['stage']>>, input: unknown[], inputDigest: string): Promise<Result> => {
                    let preview: Result;
                    for (let execution = 0; ; execution++) {
                        setPhase('calculating');
                        preview = await staged.run(input, { preview: true, stage, signal });
                        signal.throwIfAborted(); staged.assertCurrent();
                        if (!environmentFailure(preview) || execution === 1) {break;}
                    }
                    if (environmentFailure(preview)) {
                        pending = { input: structuredClone(input), stage, index: target, basis: adapter.submissionBasis(target) };
                        return preview;
                    }
                    if (!preview.ok) {return preview;}
                    setPhase('saving');
                    return staged.run(input, { preview: false, source: modelSource(stage), stage, signal,
                        ...(stage === 'before' ? { beforeUpdate: { inputDigest, outcome: 'applied' as const, diagnostics: [] } } : {}) });
                };
                if (retry) {
                    activeIndex = target;
                    const staged = await service.stage({ index: target, replaceSource: modelSource(stage), signal });
                    const result = await finish(staged, retry.input, digest(getContext().chat[target].mes));
                    setPhase(result.ok ? result.saved === false ? 'unsaved' : 'success' : 'failed');
                    return result;
                }
                const prepared = await prepare(stage, index, signal);
                if (!window.xiaobaixAgent?.openSession) {reject('agent-unavailable');}
                session = await window.xiaobaixAgent.openSession({ api: readSettings().source, signal });
                let task = prepared.task;
                for (let attempt = 0; attempt < 2; attempt++) {
                    setPhase(attempt ? 'correcting' : 'requesting');
                    const response = await session.chat({ ...task, signal });
                    prepared.staged.assertCurrent(); signal.throwIfAborted();
                    let preview: Result;
                    try {
                        preview = await finish(prepared.staged, parseSubmission(response), prepared.inputDigest);
                    } catch (error) { signal.throwIfAborted(); preview = { ok: false, diagnostics: [diagnostic(error)] }; }
                    if (preview.ok) {
                        setPhase(preview.saved === false ? 'unsaved' : 'success');
                        return preview;
                    }
                    if (!correctable(preview)) { setPhase('failed'); return preview; }
                    if (attempt) {
                        // Only a valid action rejected by its authored precondition
                        // is a story failure. Bad submissions/VM/schema errors are not.
                        if (stage === 'before' && preview.diagnostics.every(issue => issue.code === 'action-precondition')) {
                            signal.throwIfAborted(); setPhase('saving');
                            const result = await prepared.staged.recordBefore({ inputDigest: prepared.inputDigest, outcome: 'rejected', diagnostics: preview.diagnostics });
                            setPhase(result.saved === false ? 'unsaved' : 'success'); return result;
                        }
                        setPhase('failed'); return preview;
                    }
                    const submission = { text: response.text, toolCalls: response.toolCalls, completion: response.completion, truncated: response.truncated };
                    // Action titles label UI controls; the model uses action ids and descriptions.
                    task = correctionTask(prepared.task, submission, preview.diagnostics.map(issue => {
                        const detail = { ...issue }; delete detail.actionTitle; return detail;
                    }), 'state');
                }
                return { ok: false, diagnostics: [{ code: 'model-submission' }] };
            } catch (error) {
                setPhase(signal.aborted ? 'cancelled' : 'failed');
                return { ok: false, diagnostics: [signal.aborted ? { code: 'cancelled' } : diagnostic(error)] };
            } finally { session?.dispose(); controller = undefined; activeIndex = undefined; changed?.(); }
        },
    };
}
