import { resolveConversationTokens } from '../../agent-core/runtime/context-tokens.js';
import { DEFAULT_MAX_TOKENS } from '../../agent-core/config.js';
import { MEMORY_COMPACTION_PROMPT, MEMORY_MAINTENANCE_PROMPT } from './prompt.js';
import { MEMORY_TOOLS } from './tools.js';
import { requireMemory } from './errors.js';

export function createMemoryContext({ config, signal, limits, countTokens = resolveConversationTokens, summarize }) {
    const count = (messages, systemPrompt = MEMORY_MAINTENANCE_PROMPT, tools = MEMORY_TOOLS) => countTokens({
        messages: [{ role: 'system', content: systemPrompt }, ...messages], tools, providerConfig: config, signal,
    });
    const summaryTokens = Math.min(config.maxTokens || DEFAULT_MAX_TOKENS, limits.summaryTokens);

    async function summarizeText(text, notes = '') {
        let offset = 0;
        while (offset < text.length) {
            signal?.throwIfAborted();
            const message = end => [{ role: 'user', content: JSON.stringify({ workingNotes: notes,
                workFragment: { from: offset, to: end, total: text.length, text: text.slice(offset, end) } }) }];
            let low = offset, high = text.length;
            if ((await count(message(high), MEMORY_COMPACTION_PROMPT, [])).tokens <= limits.inputTokens) low = high;
            // The summary request has its own bounded input, including previous notes.
            while (low < high) {
                const mid = Math.ceil((low + high) / 2);
                if ((await count(message(mid), MEMORY_COMPACTION_PROMPT, [])).tokens <= limits.inputTokens) low = mid;
                else high = mid - 1;
            }
            requireMemory(low > offset, 'input_limit');
            const input = message(low), measured = await count(input, MEMORY_COMPACTION_PROMPT, []);
            const result = await summarize({ messages: input, systemPrompt: MEMORY_COMPACTION_PROMPT,
                tools: [], toolChoice: 'none', maxTokens: summaryTokens }, measured);
            signal?.throwIfAborted();
            requireMemory(typeof result.text === 'string' && result.text.trim() && !result.toolCalls?.length, 'compaction_failed');
            requireMemory((await count([{ role: 'user', content: result.text }], '', [])).tokens <= summaryTokens, 'compaction_failed');
            notes = result.text.trim(); offset = low;
        }
        return notes;
    }

    async function compact(messages, task, callsRemaining) {
        const cycles = [];
        for (const message of messages.slice(1)) {
            if (message.role === 'assistant') cycles.push([]);
            if (cycles.length) cycles.at(-1).push(message);
        }
        const old = JSON.parse(messages[0].content);
        let notes = old.workingNotes || '', archived = 0;
        const opening = () => ({ role: 'user', content: JSON.stringify({ task, workingNotes: notes, callsRemaining }) });
        for (const keep of [2, 1]) {
            const boundary = Math.max(0, cycles.length - keep);
            const older = cycles.slice(archived, boundary);
            if (older.length) notes = await summarizeText(JSON.stringify(older), notes);
            archived = boundary;
            // Opening memory remains in storage, not copied into working notes.
            const candidate = [opening(), ...cycles.slice(boundary).flat()];
            const measured = await count(candidate);
            if (measured.tokens < limits.compactTokens && measured.tokens <= limits.inputTokens) return { messages: candidate, measured };
        }
        requireMemory(false, 'input_limit');
    }
    return { count, compact };
}
