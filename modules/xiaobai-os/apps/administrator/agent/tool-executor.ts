import type { ManagementRegistry, ManagementResult, ManagementSession, ManagementTool } from '../../../capabilities/management/index.js';
import { MANAGEMENT_READ_CHARS, textPage } from '../../../capabilities/management/read-page.js';
import { safePromptJson } from '../../../capabilities/maintenance/prompt-safety.js';
import type { AdministratorOperation } from '../domain/types.js';
import type { createAdministratorChatReader } from '../host/chat-reader.js';
import { ADMINISTRATOR_CHAT_TOOLS } from './chat-tools.js';
import { ADMINISTRATOR_COPY } from '../ui/copy.js';
import { createAdministratorToolResults } from './tool-results.js';
import { createAdministratorId } from '../application/identity.js';

type Reader = ReturnType<typeof createAdministratorChatReader>;
export interface AdministratorConfirmation { messageIndex: number; result: ManagementResult & { receipt: AdministratorOperation } }
export async function createAdministratorToolExecutor(options: {
    registry: ManagementRegistry; reader: Reader; operations: AdministratorOperation[];
    guard(): boolean; onChange(): void; saveReceipts(confirmation?: AdministratorConfirmation): Promise<void>;
}) {
    const runId = createAdministratorId();
    const routes = new Map<string, { appId: string; tool: ManagementTool; session: ManagementSession | null }>();
    const domains: { id: string; prompt: string; data: unknown }[] = [];
    const unavailable: { id: string; error: string }[] = [];
    const evidence = createAdministratorToolResults();
    let pending: { id: string; operation: AdministratorOperation; session: ManagementSession; messageIndex: number; confirmation?: AdministratorConfirmation } | null = null;
    for (const participant of options.registry.list()) {
        let session: ManagementSession;
        try { session = await participant.open(); }
        catch (error) { unavailable.push({ id: participant.id, error: String(error instanceof Error ? error.message : error) }); continue; }
        const initial = safePromptJson(session.initial);
        domains.push({ id: participant.id, prompt: session.prompt, data: initial.length <= MANAGEMENT_READ_CHARS ? session.initial : { ...textPage(initial), detail: 'Initial data is paged. Use this APP’s read tools for the complete records.' } });
        for (const tool of session.tools) {
            if (routes.has(tool.definition.function.name)) { throw new Error('administrator_duplicate_tool'); }
            routes.set(tool.definition.function.name, { appId: participant.id, tool, session });
        }
    }
    for (const tool of ADMINISTRATOR_CHAT_TOOLS) { routes.set(tool.definition.function.name, { appId: 'story', tool, session: null }); }
    const resultRead: ManagementTool = { effect: 'read', label: ADMINISTRATOR_COPY.evidence, target: args => String(args.reference ?? ''), definition: { type: 'function', function: {
        name: 'ToolResultRead', description: `Continue a large tool result from this run. data contains reference, text, offset, nextOffset and totalChars, at most ${MANAGEMENT_READ_CHARS} text characters. Keep the same reference and follow nextOffset until null to finish this result; any continuation inside the recovered result belongs to its original tool. For expired or oversized results, read the original source again in smaller pages.`,
        parameters: { type: 'object', properties: { reference: { type: 'string', description: 'data.reference from the original result page.' }, offset: { type: 'integer', minimum: 0, description: 'data.nextOffset from the previous page; default 0.' } }, required: ['reference'], additionalProperties: false },
    } } };
    routes.set('ToolResultRead', { appId: 'administrator', tool: resultRead, session: null });
    function complete(operation: AdministratorOperation, result: ManagementResult, continuation = false) {
        operation.status = result.status;
        const report = result.data && typeof result.data === 'object' ? result.data as { applied?: unknown[]; skipped?: unknown[] } : null;
        operation.summary = report?.applied || report?.skipped
            ? ADMINISTRATOR_COPY.itemReport(report.applied?.length ?? 0, report.skipped?.length ?? 0) : ADMINISTRATOR_COPY.operations[result.status];
        const output = { ...(continuation ? result : evidence.project(operation.id, result)), receipt: { ...operation } };
        options.onChange();
        return output;
    }
    return {
        tools: [...routes.values()].map(route => route.tool.definition),
        prompt: domains.map(domain => domain.prompt).join('\n\n'),
        data: { story: options.reader.info, apps: domains.map(({ id, data }) => ({ id, data })), unavailable },
        evidence: evidence.read,
        async confirmSaved() {
            if (!pending) { return; }
            const inspection = pending.confirmation ? { status: 'confirmed' as const, result: pending.confirmation.result } : await pending.session.confirmSaved();
            if (!inspection || inspection.status !== 'confirmed') { return inspection; }
            const confirmation = pending.confirmation ??= { messageIndex: pending.messageIndex, result: complete(pending.operation, inspection.result) };
            await options.saveReceipts(confirmation);
            pending = null;
            return inspection;
        },
        async execute(name: string, raw: unknown, callId: string, messageIndex: number): Promise<unknown> {
            const id = `${runId}:${callId}`;
            const route = routes.get(name);
            if (!route) { return { ok: false, status: 'failed', code: 'tool_unavailable' }; }
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return { ok: false, status: 'failed', code: 'arguments_must_be_object' }; }
            const args = raw as Record<string, unknown>;
            if (route.tool.effect === 'write' && !options.reader.isCurrent()) {
                return { ok: false, status: 'failed', code: 'story_evidence_changed', floors: options.reader.staleFloors() };
            }
            const operation: AdministratorOperation = {
                id, appId: route.appId, name: route.tool.label, target: route.tool.target(args).slice(0, 160),
                status: route.tool.effect === 'write' ? 'saving' as const : 'reading' as const, elapsedMs: 0, summary: '',
            };
            options.operations.push(operation);
            const started = performance.now(); options.onChange();
            try {
                // Record the attempted write before dispatch, so reload cannot present it as a confirmed success.
                if (route.tool.effect === 'write') { await options.saveReceipts(); }
                let result: ManagementResult;
                if (route.session) {
                    try { result = await route.session.execute(name, args, options.guard); }
                    catch (error) { if (route.tool.effect === 'write') { pending = { id, operation, session: route.session, messageIndex }; } throw error; }
                } else {
                    const data = name === 'ChatRead' ? await options.reader.read(args) : name === 'ChatSearch' ? await options.reader.search(args) : evidence.page(id, String(args.reference), args.offset);
                    result = { ok: true, status: 'read', data };
                }
                operation.elapsedMs += Math.round(performance.now() - started);
                // The loop saves this result and its receipt together before any further dispatch.
                return complete(operation, result, name === 'ToolResultRead');
            } catch (error) {
                operation.status = pending?.id === id && (error as { uncertain?: boolean })?.uncertain ? 'unconfirmed' : 'failed';
                operation.elapsedMs += Math.round(performance.now() - started);
                operation.summary = String(error instanceof Error ? error.message : error).slice(0, 350);
                options.onChange();
                if (route.tool.effect === 'read' && (error as Error).name !== 'AbortError' && (error as Error).message !== 'administrator_context_changed') {
                    return { ok: false, status: 'failed', code: (error as Error).message, receipt: { ...operation } };
                }
                throw error;
            }
        },
        preview(names: string[]): AdministratorOperation[] {
            return names.slice(0, 6).flatMap((name, index) => {
                const route = routes.get(name);
                return route ? [{ id: `preview-${index}`, appId: route.appId, name: route.tool.label, target: '', status: 'preparing' as const, elapsedMs: 0, summary: '' }] : [];
            });
        },
    };
}
export type AdministratorToolExecutor = Awaited<ReturnType<typeof createAdministratorToolExecutor>>;
