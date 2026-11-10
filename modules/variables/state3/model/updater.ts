import type { PublicAgentSession, AgentChatResult } from '../../../agent-core/public-api.js';
import { correctionTask } from '../../updater/correction.js';
import type { Result, RunOptions } from '../types.js';
import type { SettlementService } from '../runtime/service.js';
import { state3Context as getContext, type createHostAdapter } from '../runtime/host.js';
import { exposeVariableReads } from '../../var-commands.js';
import { captureContext } from '../../shared/context-capture.js';
import { passageText } from '../../shared/passage.js';
import { compileDefinition } from '../definition/compile.js';
import { buildUpdateTask } from './prompts.js';
import { SUBMIT_TOOL } from './tools.js';
import { readSettings } from '../runtime/settings.js';
import { reject, diagnostic } from '../engine/diagnostics.js';

export function parseSubmission(response: AgentChatResult): unknown[] {
    if (response.truncated || response.completion !== 'complete') {reject('model-submission', { completion: response.completion, truncated: response.truncated, response: response.text });}
    if (response.toolCalls?.length !== 1 || response.toolCalls[0].name !== SUBMIT_TOOL) {reject('model-submission', { response: response.text });}
    let args;
    try { args = JSON.parse(response.toolCalls[0].arguments); } catch { reject('model-submission'); }
    if (!args || Object.keys(args).length !== 1 || !Array.isArray(args.state)) {reject('model-submission');}
    return args.state;
}

export function createState3Updater({ service, adapter, available, changed }: { service: SettlementService; adapter: ReturnType<typeof createHostAdapter>; available(): void; changed?(): void }) {
    let controller: AbortController | undefined, phase = 'ready';
    const setPhase = (value: string) => { phase = value; changed?.(); };
    const cancel = () => { controller?.abort(); };
    async function prepare(signal?: AbortSignal) {
        available();
        const staged = await service.stage({ replaceSource: 'model', signal });
        const ctx = getContext(), message = ctx.chat[staged.target.floor];
        if (!message || message.is_user || message.is_system || !message.mes?.trim()) {reject('target-missing');}
        const snapshot = adapter.capture(staged.target.floor);
        const compiled = compileDefinition(staged.bundle);
        const reservation = buildUpdateTask(compiled, staged.snapshot, { target: staged.target, messages: [] });
        const context = await captureContext(ctx, { ...staged.target, message }, reservation,
            passageText, signal,
            () => exposeVariableReads(staged.snapshot, staged.roots));
        staged.assertCurrent();
        if (!adapter.isCurrent(snapshot)) {reject('stale-target');}
        return { ok: true, staged, task: buildUpdateTask(compiled, staged.snapshot, context) };
    }
    return {
        cancel,
        status: () => ({ phase, busy: Boolean(controller) }),
        async previewRequest({ signal }: RunOptions = {}) {
            const prepared = await prepare(signal);
            return prepared.task;
        },
        async update(): Promise<Result> {
            if (controller) {reject('commit-busy');}
            const own = new AbortController(); controller = own; const { signal } = own;
            let session: PublicAgentSession | undefined;
            try {
                setPhase('preparing');
                const prepared = await prepare(signal);
                if (!window.xiaobaixAgent?.openSession) {reject('agent-unavailable');}
                session = await window.xiaobaixAgent.openSession({ api: readSettings().source, signal });
                let task = prepared.task;
                for (let attempt = 0; attempt < 2; attempt++) {
                    setPhase(attempt ? 'correcting' : 'requesting');
                    const response = await session.chat({ ...task, signal });
                    prepared.staged.assertCurrent(); signal.throwIfAborted();
                    let input: unknown, preview: Result;
                    try {
                        input = parseSubmission(response);
                        preview = await prepared.staged.run(input, { preview: true, source: 'model', signal });
                    } catch (error) { preview = { ok: false, diagnostics: [diagnostic(error)] }; }
                    if (preview.ok) {
                        setPhase('saving');
                        const result = await prepared.staged.run(input, { preview: false, source: 'model', signal });
                        setPhase(result.ok ? result.saved ? 'success' : 'unsaved' : 'failed');
                        return result;
                    }
                    if (attempt) { setPhase('failed'); return preview; }
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
            } finally { session?.dispose(); controller = undefined; changed?.(); }
        },
    };
}
