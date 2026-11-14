import { resetMessageWindow } from '../../../agent-core/ui/message-windowing.js';
import { recentTurnArchiveCounts, hasChatAnswer } from '../../../agent-core/runtime/recent-turns.js';
import { ACTIVITY_COPY } from '../ui/activity-copy.js';
import { loadedSkillIds } from '../../shared/skill-tools.js';
import { dropInvalidatedThinkingFromMessage } from '../../../agent-core/runtime/protocol.js';
import { estimateTokenCount, estimateConversationTokens } from '../../../agent-core/runtime/context-tokens.js';

// Newest tool cycles of the in-progress request kept verbatim, preferred first.
const RETAINED_CURRENT_CYCLES = [2, 1];

export function splitMessagesIntoTurns(messages = []) {
    const turns = [];
    let currentTurn = [];

    (messages || []).filter((message) => !message?.approvalRequest).forEach((message) => {
        if (message.role === 'user' && currentTurn.length) {
            turns.push(currentTurn);
            currentTurn = [message];
            return;
        }
        currentTurn.push(message);
    });

    if (currentTurn.length) {
        turns.push(currentTurn);
    }

    return turns.filter((turn) => turn.length);
}

export function createHistoryCompactionController(deps) {
    const {
        state,
        render,
        persistSession,
        showToast,
        getActiveProviderConfig,
        formatToolResultDisplay,
        buildTextWithAttachmentSummary,
        SUMMARY_SYSTEM_PROMPT,
        compactionThreshold,
        requestInputLimit,
        buildContextMeterLabel,
        updateContextStats,
        toProviderMessages,
    } = deps;

    function normalizeSummarySourceText(text) {
        return String(text || '').replace(/\r\n/g, '\n').trim();
    }

    function getMessageTextForSummary(message) {
        if (message?.approvalRequest) {
            return '';
        }
        if (message.role === 'tool') {
            const display = formatToolResultDisplay(message);
            const lines = [
                display?.summary ? `工具摘要:\n${display.summary}` : '',
                display?.details ? `工具输出详情:\n${display.details}` : '',
                !display?.summary && !display?.details ? `工具原始结果:\n${message.content || ''}` : '',
            ].filter(Boolean);
            return normalizeSummarySourceText(lines.join('\n\n'));
        }
        if (message.role === 'assistant' && Array.isArray(message.toolCalls) && message.toolCalls.length) {
            const toolLines = message.toolCalls.map((toolCall) => `工具: ${toolCall.name} ${toolCall.arguments || '{}'}`.trim());
            return normalizeSummarySourceText([message.content || '', ...toolLines].filter(Boolean).join('\n'));
        }
        return normalizeSummarySourceText(buildTextWithAttachmentSummary(message.content || '', message.attachments));
    }

    function messageLabel(message) {
        return message.role === 'user'
            ? '用户'
            : message.role === 'assistant'
                ? '助手'
                : `工具${message.toolName ? `(${message.toolName})` : ''}`;
    }

    // Archived history can exceed one request (a long tool run may hold whole
    // written files). It is read in consecutive pieces of at most half the
    // request capacity, leaving the rest for the running summary it is folded into.
    function buildSummaryChunks(turns) {
        const limit = Math.max(1, Math.floor(requestInputLimit() / 2));
        // A character is at most four UTF-8 bytes, so this slice fits the token limit.
        const pieceChars = Math.max(1, Math.floor(limit * 3.35 / 4));
        const pieces = turns.flatMap((turn, index) => [
            `第 ${index + 1} 段历史:`,
            ...turn.map(message => `${messageLabel(message)}: ${getMessageTextForSummary(message) || '[空]'}`),
            '',
        ]).flatMap(line => (line.length <= pieceChars ? [line]
            : Array.from({ length: Math.ceil(line.length / pieceChars) }, (_, index) => line.slice(index * pieceChars, (index + 1) * pieceChars))));
        const chunks = [];
        let size = Infinity;
        for (const piece of pieces) {
            const tokens = estimateTokenCount(piece) + 1;
            if (size + tokens > limit) { chunks.push([]); size = 0; }
            chunks.at(-1).push(piece);
            size += tokens;
        }
        return chunks;
    }

    function buildSummarySource(lines, existingSummary = '') {
        return [
            ...(existingSummary?.trim()
                ? ['已有历史摘要（当前记忆底稿，除非新增历史明确纠正，否则需要合并保留）:', existingSummary.trim(), '']
                : []),
            ...lines,
        ].join('\n').trim();
    }

    function getActiveContextMessages() {
        const turns = splitMessagesIntoTurns(state.messages);
        const archivedCount = Math.min(state.archivedTurnCount, turns.length);
        return turns.slice(archivedCount).flat();
    }

    function pruneArchivedTurnsFromState() {
        const turns = splitMessagesIntoTurns(state.messages);
        const archivedCount = Math.min(state.archivedTurnCount, turns.length);
        if (archivedCount <= 0) return false;
        state.archivedSkillIds = loadedSkillIds(turns.slice(0, archivedCount).flat(), state.archivedSkillIds);
        state.messages = turns.slice(archivedCount).flat();
        state.archivedTurnCount = 0;
        resetMessageWindow(state);
        return true;
    }

    async function summarizeArchivedTurns(adapter, turnsToArchive, signal) {
        if (!turnsToArchive.length) return;

        const providerConfig = getActiveProviderConfig();

        try {
            let summary = state.historySummary;
            for (const lines of buildSummaryChunks(turnsToArchive)) {
                const request = {
                    systemPrompt: SUMMARY_SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: buildSummarySource(lines, summary) }],
                    tools: [],
                    toolChoice: 'none',
                    temperature: Math.min(providerConfig.temperature ?? 0.2, 0.2),
                    maxTokens: providerConfig.maxTokens,
                    reasoning: { mode: 'inherit', output: 'hide' },
                    signal,
                };
                const inputTokens = estimateConversationTokens({ messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages],
                    tools: request.tools, providerConfig });
                if (inputTokens > requestInputLimit()) throw new Error(ACTIVITY_COPY.summaryOverBudget(inputTokens, requestInputLimit()));
                const result = await adapter.chat(request);
                signal?.throwIfAborted();
                const nextSummary = String(result.text || '').trim();
                if (!nextSummary) throw new Error(ACTIVITY_COPY.summaryEmpty);
                summary = nextSummary;
            }
            state.historySummary = summary;
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw error;
            throw Object.assign(new Error(ACTIVITY_COPY.summaryFailed(error.message), { cause: error }), { code: 'assistant_summary_failed' });
        }
    }

    async function ensureContextBudget(adapter, signal, options = {}) {
        signal?.throwIfAborted();
        let contextMessages = getActiveContextMessages();
        let providerMessages = toProviderMessages(contextMessages, options);
        updateContextStats(providerMessages);

        if (state.contextStats.usedTokens <= compactionThreshold()) {
            return providerMessages;
        }

        const turns = splitMessagesIntoTurns(contextMessages);
        // ensureContextBudget runs before each model call, so the final turn is
        // still in progress, including every tool call/result in that request.
        const boundaries = recentTurnArchiveCounts(turns.slice(0, -1), hasChatAnswer);
        let archived = 0;
        for (const boundary of boundaries) {
            const desiredArchivedTurnCount = state.archivedTurnCount + boundary - archived;
            if (desiredArchivedTurnCount > state.archivedTurnCount) {
                const turnsToArchive = turns.slice(archived, boundary);
                const previousProgressLabel = state.progressLabel;
                state.progressLabel = '总结中';
                render();
                try {
                    await summarizeArchivedTurns(adapter, turnsToArchive, signal);
                } finally {
                    state.progressLabel = previousProgressLabel || '生成中';
                    render();
                }
                state.archivedTurnCount = desiredArchivedTurnCount;
                pruneArchivedTurnsFromState();
                persistSession();
            }
            archived = boundary;

            contextMessages = getActiveContextMessages();
            providerMessages = toProviderMessages(contextMessages, options);
            signal?.throwIfAborted();
            updateContextStats(providerMessages);
            if (state.contextStats.usedTokens <= compactionThreshold()) {
                showToast(`已压缩较早历史，当前上下文 ${buildContextMeterLabel()}`);
                render();
                return providerMessages;
            }
        }

        // A single long request can outgrow the context by itself. Its earlier
        // tool cycles become summary material; the request and the newest
        // cycles stay verbatim so the model can continue from them.
        for (const keep of RETAINED_CURRENT_CYCLES) {
            // Thinking cleanup replaces assistant objects. Use the current history
            // on each pass so calls and results are removed as one group.
            const currentTurn = splitMessagesIntoTurns(contextMessages).at(-1) || [];
            const firstReply = currentTurn.findIndex(message => message.role === 'assistant');
            const cycles = [];
            for (const message of firstReply < 0 ? [] : currentTurn.slice(firstReply)) {
                if (message.role === 'assistant' || !cycles.length) cycles.push([]);
                cycles.at(-1).push(message);
            }
            const boundary = cycles.length - keep;
            if (boundary <= 0) continue;
            const archivedMessages = cycles.slice(0, boundary).flat();
            const previousProgressLabel = state.progressLabel;
            state.progressLabel = '总结中';
            render();
            try {
                await summarizeArchivedTurns(adapter, [archivedMessages], signal);
            } finally {
                state.progressLabel = previousProgressLabel || '生成中';
                render();
            }
            const removed = new Set(archivedMessages);
            const retained = new Set(cycles.slice(boundary).flat());
            state.archivedSkillIds = loadedSkillIds(archivedMessages, state.archivedSkillIds);
            state.messages = state.messages.filter(message => !removed.has(message))
                .map(message => (retained.has(message) ? dropInvalidatedThinkingFromMessage(message) : message));
            resetMessageWindow(state);
            persistSession();

            contextMessages = getActiveContextMessages();
            providerMessages = toProviderMessages(contextMessages, options);
            signal?.throwIfAborted();
            updateContextStats(providerMessages);
            if (state.contextStats.usedTokens <= compactionThreshold()) {
                showToast(`已压缩本轮较早的工具记录，当前上下文 ${buildContextMeterLabel()}`);
                render();
                return providerMessages;
            }
        }

        if (state.contextStats.usedTokens > requestInputLimit()) {
            throw Object.assign(new Error(ACTIVITY_COPY.contextFull(state.contextStats.usedTokens, requestInputLimit())), { code: 'assistant_context_over_budget' });
        }
        showToast(`最近对话本身已接近上限，当前上下文 ${buildContextMeterLabel()}`);
        render();
        return providerMessages;
    }

    return {
        ensureContextBudget,
        getActiveContextMessages,
        pruneArchivedTurnsFromState,
    };
}
