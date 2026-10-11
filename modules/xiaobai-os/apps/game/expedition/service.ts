import { ECONOMY_TRANSACTION_CAPABILITY, type EconomyReadCapability } from '../../../capabilities/economy/index.js';
import type { PartitionStore, XiaobaiOsFileControls, XiaobaiOsFileState } from '../../../kernel/contracts.js';
import { advanceExpedition, emptyExpedition, expeditionProgress } from './domain.js';
import { expeditionRights, postExpeditionMoney, validateEconomy } from './economy.js';
import { EXPEDITION_PARTITION, expeditionId, parseCommand, boundedText } from './partition.js';
import { fault } from './random.js';
import type { Command, ExpeditionData } from './types.js';
import type { AgentCapability } from '../../../capabilities/agent/index.js';
import type { Participant } from './content/participants.js';
import { canTalk, CAMPAIGN_RULES } from './campaign/rules.js';
import { rewindReply } from './campaign/reply-checkpoint.js';
import type { ConversationMemory } from './campaign/types.js';
import { applyReply } from './narrative/apply-reply.js';
import { generateConversation, type ConversationOptions } from './narrative/conversation.js';

export interface ExpeditionView {
    data: ExpeditionData & ReturnType<typeof expeditionProgress>; balance: number; ready: boolean; pending: boolean; writeState: XiaobaiOsFileState;
    conversation: { actionId: string; person: Participant; text: string; regenerating: boolean } | null;
    replyFailure: { actionId: string; person: Participant; playerText: string; regenerating: boolean; text: string | null; code: string } | null;
}
export interface ExpeditionRequest { actionId: string; revision: number; command: Command }
export function createExpeditionService(store: PartitionStore<ExpeditionData>, files: XiaobaiOsFileControls, economy: EconomyReadCapability,
    dependencies: { seed?: () => number; idle?: () => boolean; agent?: AgentCapability } & Partial<Pick<ConversationOptions, 'loadCanon' | 'countTokens'>> = {}) {
    let conversation: ExpeditionView['conversation'] = null, replyFailure: ExpeditionView['replyFailure'] = null;
    function view(): ExpeditionView {
        let data: ExpeditionData;
        try { data = structuredClone(store.peekCurrent()?.value ?? emptyExpedition()); }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'partition_invalid') {
                if (files.hasPendingCommit(EXPEDITION_PARTITION.key)) {
                    fault(files.getFileState() === 'failed' ? 'save_failed' : files.getFileState() === 'conflict' ? 'save_conflict' : 'save_unconfirmed', error);
                }
                fault('data_invalid', error);
            }
            throw error;
        }
        return { data: { ...data, ...expeditionProgress(data) }, balance: economy.getPlayerBalance(), ready: economy.isOpen(),
            pending: files.hasPendingCommit(EXPEDITION_PARTITION.key), writeState: files.getFileState(), conversation, replyFailure };
    }
    async function refresh() { await economy.refresh(); await store.readRaw(); return view(); }
    async function act(input: ExpeditionRequest, guard: () => boolean): Promise<ExpeditionView> {
        expeditionId(input.actionId); const command = parseCommand(input.command);
        if (!Number.isSafeInteger(input.revision) || input.revision < 0) { fault('invalid'); }
        const allowed = () => guard() && (dependencies.idle?.() ?? true);
        if (!allowed()) { fault('unavailable'); }
        let accepted = false;
        const result = await store.transact(transaction => {
            if (!allowed()) { fault('unavailable'); }
            const data = transaction.current ?? emptyExpedition(), money = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
            validateEconomy(data, money);
            if (data.last?.id === input.actionId) { if (JSON.stringify(data.last.command) !== JSON.stringify(command)) { fault('identity'); } return; }
            if (data.revision !== input.revision) { fault('stale'); }
            const seed = command.type === 'start' || command.type === 'restart' ? (dependencies.seed?.() ?? crypto.getRandomValues(new Uint32Array(1))[0]) : 0;
            const next = advanceExpedition(data, command, input.actionId, seed);
            postExpeditionMoney(data, next, money); validateEconomy(next, money); transaction.replace(next); accepted = true;
        }, { retainFailedCandidate: true, commitGuard: () => (accepted || guard()) && (dependencies.idle?.() ?? true) });
        if (result.status !== 'confirmed' && result.status !== 'unchanged') { throw Object.assign(new Error(`expedition_save_${result.status}`), { code: `expedition_save_${result.status}` }); }
        if (command.type === 'start' || command.type === 'restart') { replyFailure = null; }
        return view();
    }
    async function converse(input: { actionId: string; revision: number; person: Participant; text: string; regenerate?: string }, guard: () => boolean, signal: AbortSignal) {
        expeditionId(input.actionId); boundedText(input.text, CAMPAIGN_RULES.playerTextLimit);
        if (input.regenerate !== undefined) { expeditionId(input.regenerate); }
        const allowed = () => guard() && !signal.aborted;
        const current = view().data, saved = current.active;
        if (!allowed() || conversation || !(dependencies.idle?.() ?? true) || !saved) { fault('unavailable'); }
        const previous = saved.conversations[input.person].find(t => t.id === input.actionId);
        if (previous) { if (previous.player !== input.text || previous.regeneratedFrom !== input.regenerate) { fault('identity'); } return view(); }
        if (current.revision !== input.revision) { fault('stale'); }
        const campaign = input.regenerate ? rewindReply(saved, input.person, input.regenerate) : saved;
        if (input.regenerate && saved.conversations[input.person].at(-1)?.player !== input.text) { fault('identity'); }
        if (!canTalk(campaign, input.person)) { fault('unavailable'); }
        if (!dependencies.agent) { fault('agent_not_configured'); }
        let revision = input.revision, received: Record<string, unknown> | null = null;
        let replacementMemory: ConversationMemory | null = campaign.memories[input.person];
        conversation = { actionId: input.actionId, person: input.person, text: input.text, regenerating: !!input.regenerate };
        replyFailure = null;
        try {
        const response = await generateConversation(dependencies.agent, campaign, input.person, input.text, signal, {
            loadCanon: dependencies.loadCanon, countTokens: dependencies.countTokens,
            received: result => { received = result; },
            async saveMemory(memory) {
                if (input.regenerate) { replacementMemory = memory; return; }
                let accepted = false;
                const result = await store.transact(transaction => {
                    if (!allowed()) { fault('cancelled'); }
                    const data = transaction.current;
                    if (!data?.active || data.active.id !== campaign.id || data.revision !== revision) { fault('stale'); }
                    const next = structuredClone(data); next.active!.memories[input.person] = memory; next.revision++;
                    transaction.replace(next); accepted = true;
                }, { retainFailedCandidate: true, commitGuard: () => accepted || allowed() });
                if (result.status !== 'confirmed' && result.status !== 'unchanged') { fault(`save_${result.status}`); }
                revision++;
            },
        });
        if (!allowed()) { fault('unavailable'); }
        if (input.regenerate && response.kind === 'receipt') { fault(response.issue); }
        let accepted = false;
        const result = await store.transact(transaction => {
            if (!allowed()) { fault('unavailable'); }
            const data = transaction.current;
            if (!data || data.revision !== revision || !data.active || data.active.id !== campaign.id) { fault('stale'); }
            const next = structuredClone(data);
            if (input.regenerate) {
                next.active = rewindReply(data.active, input.person, input.regenerate);
                next.active.memories[input.person] = replacementMemory;
            }
            if (!canTalk(next.active!, input.person)) { fault('stale'); }
            applyReply(next.active!, input, response);
            next.revision++;
            next.last = { id: input.actionId, command: { type: 'conversation', person: input.person, text: input.text } };
            const money = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
            validateEconomy(data, money); postExpeditionMoney(data, next, money); validateEconomy(next, money);
            transaction.replace(next); accepted = true;
        }, { retainFailedCandidate: true, commitGuard: () => accepted || allowed() });
        if (result.status !== 'confirmed' && result.status !== 'unchanged') { throw Object.assign(new Error(`expedition_save_${result.status}`), { code: `expedition_save_${result.status}` }); }
        replyFailure = response.issue ? { actionId: input.actionId, person: input.person, playerText: input.text, regenerating: !!input.regenerate, text: null, code: `expedition_${response.issue}` } : null;
        } catch (error) {
            const result = received as Record<string, unknown> | null;
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'expedition_agent_failed';
            if (guard() && code !== 'expedition_cancelled') {
                replyFailure = { actionId: input.actionId, person: input.person, playerText: input.text, regenerating: !!input.regenerate, text: typeof result?.text === 'string' ? result.text : null, code };
            }
            throw error;
        } finally { conversation = null; }
        return view();
    }
    return { view, refresh, act, converse,
        async rebuild(actionId: string, guard: () => boolean) {
            expeditionId(actionId);
            const allowed = () => guard() && !conversation && (dependencies.idle?.() ?? true);
            const result = await store.transact(transaction => {
                if (!allowed()) { fault('unavailable'); }
                // This destructive command is offered only for invalid test data, never a valid journey.
                if (transaction.rawCurrent === undefined || EXPEDITION_PARTITION.parse(transaction.rawCurrent).ok) { fault('unavailable'); }
                const next = expeditionRights(transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY));
                next.revision = 1; next.last = { id: actionId, command: { type: 'rebuild' } };
                transaction.replace(next);
            }, { retainFailedCandidate: true, commitGuard: allowed });
            if (result.status !== 'confirmed' && result.status !== 'unchanged') { fault(`save_${result.status}`); }
            replyFailure = null; return view();
        },
        async confirm(guard: () => boolean) {
            if (files.hasPendingCommit() && !files.hasPendingCommit(EXPEDITION_PARTITION.key)) { fault('unavailable'); }
            if (!guard() || !(dependencies.idle?.() ?? true)) { fault('unavailable'); }
            await files.retryPending({ beforeRetry: guard });
            const next = await refresh();
            if (replyFailure && (next.data.active?.conversations[replyFailure.person].some(turn => turn.id === replyFailure!.actionId)
                || replyFailure.code.startsWith('expedition_save_') && !next.pending && next.writeState === 'ready')) { replyFailure = null; }
            return view();
        },
        // User-file notifications cover game writes without parsing an invalid optional partition before the owner can handle it.
        subscribe(listener: () => void) { const stops = [economy.subscribe(listener), files.subscribeFileState(listener)]; return () => stops.forEach(stop => stop()); },
    };
}
export type ExpeditionService = ReturnType<typeof createExpeditionService>;
