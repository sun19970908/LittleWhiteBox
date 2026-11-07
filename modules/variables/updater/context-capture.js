import { Generate, main_api, chat, name2, setCharacterId, setCharacterName } from '../../../../../../../script.js';
import { promptManager } from '../../../../../../openai.js';
import { PromptCollection } from '../../../../../../PromptManager.js';
import { IGNORE_SYMBOL } from '../../../../../../constants.js';
import { getContext } from '../../../../../../extensions.js';
import { isGenerating } from '../../../shared/common/sillytavern-generation-state.js';
import { COPY } from './copy.js';
import { replaceRules } from '../state2/guard-core.js';

// This updater owns its template, not the user's active RP preset. SillyTavern
// still owns WI activation, hidden messages, regexes, extension inserts and budget.
const MATERIAL_ORDER = ['personaDescription', 'charDescription', 'charPersonality',
    'worldInfoBefore', 'worldInfoAfter', 'scenario', 'dialogueExamples', 'chatHistory'];
let capturing = false;
let captureSequence = 0;

export async function captureContext(ctx, target, reservation, cleanPassage, signal, snapshot) {
    if (capturing) throw new Error(COPY.contextBusy);
    if (isGenerating()) throw new Error(COPY.busy);
    if (main_api !== 'openai' || !promptManager) throw new Error(COPY.contextUnavailable);
    if (target.message.extra?.[IGNORE_SYMBOL]) throw new Error(COPY.targetMissing);
    signal?.throwIfAborted();
    const reading = structuredClone(snapshot);
    capturing = true;
    const manager = promptManager;
    const nonce = `${Date.now()}-${++captureSequence}`;
    const captureSignal = signal || new AbortController().signal;
    const characterName = name2;
    const marker = kind => [`<${kind}-${nonce}>`, `</${kind}-${nonce}>`];
    const budget = marker('variable-budget'), passage = marker('variable-target'), pending = marker('variable-pending');
    const original = {
        collection: manager.getPromptCollection, prepare: manager.preparePrompt,
        disabled: manager.isPromptDisabledForActiveCharacter,
        inspection: manager.setChatCompletion,
    };
    // Host macros and extension injections read chatMetadata, not read_writing_guide.
    // Expose the same rolled-back values for the entire dry run, then restore the
    // live state before requesting a model. No rollback is saved by this preview.
    const metadata = ctx.chatMetadata;
    const liveVariables = metadata.variables, liveRules = metadata.LWB_RULES_V2;
    let stateRestored = false;
    let captured, targetSeen = false, interrupted = false;
    const prepare = function(prompt, ...args) {
        const result = original.prepare.call(this, prompt, ...args);
        // SillyTavern visits chatHistory from newest to oldest. Injected depth
        // prompts have no speaker name; never mistake one for the target reply.
        if (prompt.identifier?.startsWith('chatHistory-') && prompt.name) {
            if (!targetSeen && prompt.role === 'assistant' && prompt.name === target.message.name) {
                targetSeen = true;
                result.content = passage[0] + cleanPassage(result.content) + passage[1];
            } else if (!targetSeen && prompt.role === 'user') {
                result.content = pending[0] + result.content + pending[1];
            } else if (prompt.role === 'assistant') result.content = cleanPassage(result.content);
        }
        return result;
    };
    const collection = function(type) {
        if (type !== 'quiet') return original.collection.call(this, type);
        const entries = [{ identifier: 'main', role: 'system', content: budget[0] + JSON.stringify(reservation) + budget[1],
            forbid_overrides: true, system_prompt: true },
        ...MATERIAL_ORDER.map(identifier => ({ identifier, role: 'system', content: '', system_prompt: true }))];
        return new PromptCollection(...entries.map(prompt => original.prepare.call(this, prompt)));
    };
    const disabled = function(identifier) {
        return identifier === 'main' || MATERIAL_ORDER.includes(identifier) ? false : original.disabled.call(this, identifier);
    };
    const capture = event => {
        if (event.dryRun && JSON.stringify(event.chat).includes(budget[0])) captured = event;
    };
    // The dry run is our request preview, not the RP preset's token inspector.
    const inspect = () => {};
    const restore = () => {
        if (manager.getPromptCollection === collection) manager.getPromptCollection = original.collection;
        if (manager.preparePrompt === prepare) manager.preparePrompt = original.prepare;
        if (manager.isPromptDisabledForActiveCharacter === disabled) manager.isPromptDisabledForActiveCharacter = original.disabled;
        if (manager.setChatCompletion === inspect) manager.setChatCompletion = original.inspection;
        if (!stateRestored) {
            stateRestored = true;
            metadata.variables = liveVariables;
            if (liveRules === undefined) delete metadata.LWB_RULES_V2;
            else metadata.LWB_RULES_V2 = liveRules;
            replaceRules(getContext().chatMetadata?.LWB_RULES_V2 || {});
        }
    };
    // A foreground generation must never borrow this temporary template.
    const started = (_type, options) => {
        if (options?.signal !== captureSignal) { interrupted = true; restore(); }
    };
    const chatChanged = () => { interrupted = true; restore(); };
    manager.getPromptCollection = collection;
    manager.preparePrompt = prepare;
    manager.isPromptDisabledForActiveCharacter = disabled;
    manager.setChatCompletion = inspect;
    metadata.variables = reading.variables;
    metadata.LWB_RULES_V2 = reading.rules;
    replaceRules(reading.rules);
    ctx.eventSource.on(ctx.eventTypes.CHAT_COMPLETION_PROMPT_READY, capture);
    ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, started);
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, chatChanged);
    signal?.addEventListener('abort', restore, { once: true });
    try {
        await Generate('quiet', { signal: captureSignal }, true);
        signal?.throwIfAborted();
        if (interrupted) throw new Error(COPY.contextBusy);
        if (!Array.isArray(captured?.chat)) throw new Error(COPY.contextMissing);
        let found = false;
        const strip = (text, tags, replace = () => '') => {
            const start = text.indexOf(tags[0]);
            if (start === -1) return text;
            const end = text.indexOf(tags[1], start + tags[0].length);
            if (end === -1) throw new Error(COPY.contextMissing);
            return text.slice(0, start) + replace(text.slice(start + tags[0].length, end)) + text.slice(end + tags[1].length);
        };
        const clean = text => strip(strip(strip(text, budget), pending), passage, content => {
            if (content.trim()) found = true;
            return `<variable-update-target>\n${content}\n</variable-update-target>`;
        });
        const hasPending = message => typeof message.content === 'string' ? message.content.includes(pending[0])
            : Array.isArray(message.content) && message.content.some(part => part.type === 'text' && part.text.includes(pending[0]));
        // A pending user's attachments belong to that message too. Remove the
        // complete message rather than leaving its image/audio parts behind.
        const messages = structuredClone(captured.chat).filter(message => !hasPending(message)).map(message => ({ ...message,
            content: typeof message.content === 'string' ? clean(message.content)
                : Array.isArray(message.content) ? message.content.map(part => part.type === 'text' ? { ...part, text: clean(part.text) } : part)
                    : message.content,
        })).filter(message => message.tool_calls?.length || (typeof message.content === 'string' ? message.content.trim() : message.content?.length));
        if (!found) throw new Error(COPY.targetMissing);
        return { target: { floor: target.floor, swipeId: target.swipeId }, messages };
    } finally {
        restore();
        // SillyTavern's group dry run temporarily selects its first member.
        if (ctx.groupId != null && ctx.chat === chat && !interrupted) {
            setCharacterId(ctx.characterId);
            setCharacterName(characterName);
        }
        signal?.removeEventListener('abort', restore);
        ctx.eventSource.removeListener(ctx.eventTypes.CHAT_COMPLETION_PROMPT_READY, capture);
        ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_STARTED, started);
        ctx.eventSource.removeListener(ctx.eventTypes.CHAT_CHANGED, chatChanged);
        capturing = false;
    }
}
