import { Generate, main_api, chat, name2, setCharacterId, setCharacterName } from '../../../../../../../script.js';
import { promptManager } from '../../../../../../openai.js';
import { PromptCollection, type Prompt as HostPrompt } from '../../../../../../PromptManager.js';
import { IGNORE_SYMBOL } from '../../../../../../constants.js';
import { isGenerating } from '../../../shared/common/sillytavern-generation-state.js';
import { CONTEXT_COPY as COPY } from './context-copy.js';

const MATERIAL_ORDER = ['personaDescription', 'charDescription', 'charPersonality',
    'worldInfoBefore', 'worldInfoAfter', 'scenario', 'dialogueExamples', 'chatHistory'];
let capturing = false;
let captureSequence = 0;

interface Prompt { identifier?: string; name?: string; role?: string; content: string; [key: string]: unknown }
interface Manager {
    getPromptCollection(type: string): unknown;
    preparePrompt(prompt: Prompt, ...args: unknown[]): HostPrompt;
    isPromptDisabledForActiveCharacter(identifier: string): boolean;
    setChatCompletion(...args: never[]): unknown;
}
interface ContentPart { type: string; text?: string; [key: string]: unknown }
interface CapturedMessage { role: string; content: string | ContentPart[]; tool_calls?: unknown[] }
export interface CaptureContext {
    chat: object[]; characterId: number; groupId?: string | null;
    eventTypes: Record<string, string>;
    eventSource: {
        on(event: string, callback: (...args: never[]) => unknown): unknown;
        removeListener(event: string, callback: (...args: never[]) => unknown): unknown;
    };
}
interface CaptureTarget { floor: number; swipeId: number; message: { name?: string; extra?: Record<PropertyKey, unknown> } }

// Version-neutral host capture. It never modifies stored variables or rules.
// Engines with independent macro projections may expose and restore those here.
export async function captureContext(ctx: CaptureContext, target: CaptureTarget, reservation: unknown,
    cleanPassage: (text: string) => string, signal: AbortSignal | undefined, exposeState?: () => () => void) {
    if (capturing) {throw new Error(COPY.contextBusy);}
    if (isGenerating()) {throw new Error(COPY.busy);}
    if (main_api !== 'openai' || !promptManager) {throw new Error(COPY.contextUnavailable);}
    if (target.message.extra?.[IGNORE_SYMBOL]) {throw new Error(COPY.targetMissing);}
    signal?.throwIfAborted();
    capturing = true;
    const manager = promptManager as unknown as Manager;
    const nonce = `${Date.now()}-${++captureSequence}`;
    const captureSignal = signal || new AbortController().signal;
    const characterName = name2;
    const marker = (kind: string) => [`<${kind}-${nonce}>`, `</${kind}-${nonce}>`];
    const budget = marker('variable-budget'), passage = marker('variable-target'), pending = marker('variable-pending');
    const original = {
        collection: manager.getPromptCollection, prepare: manager.preparePrompt,
        disabled: manager.isPromptDisabledForActiveCharacter, inspection: manager.setChatCompletion,
    };
    let restoreState: (() => void) | undefined, stateRestored = false;
    let captured: { chat: CapturedMessage[] } | undefined, targetSeen = false, interrupted = false;
    const prepare = function(this: Manager, prompt: Prompt, ...args: unknown[]) {
        const result = original.prepare.call(this, prompt, ...args);
        if (prompt.identifier?.startsWith('chatHistory-') && prompt.name) {
            if (!targetSeen && prompt.role === 'assistant' && prompt.name === target.message.name) {
                targetSeen = true; result.content = passage[0] + cleanPassage(result.content) + passage[1];
            } else if (!targetSeen && prompt.role === 'user') {result.content = pending[0] + result.content + pending[1];}
            else if (prompt.role === 'assistant') {result.content = cleanPassage(result.content);}
        }
        return result;
    };
    const collection = function(this: Manager, type: string) {
        if (type !== 'quiet') {return original.collection.call(this, type);}
        const entries = [{ identifier: 'main', role: 'system', content: budget[0] + JSON.stringify(reservation) + budget[1],
            forbid_overrides: true, system_prompt: true },
        ...MATERIAL_ORDER.map(identifier => ({ identifier, role: 'system', content: '', system_prompt: true }))];
        return new PromptCollection(...entries.map(prompt => original.prepare.call(this, prompt)));
    };
    const disabled = function(this: Manager, identifier: string) {
        return identifier === 'main' || MATERIAL_ORDER.includes(identifier) ? false : original.disabled.call(this, identifier);
    };
    const capture = (event: { dryRun?: boolean; chat: CapturedMessage[] }) => { if (event.dryRun && JSON.stringify(event.chat).includes(budget[0])) {captured = event;} };
    const inspect = () => {};
    const restore = () => {
        if (manager.getPromptCollection === collection) {manager.getPromptCollection = original.collection;}
        if (manager.preparePrompt === prepare) {manager.preparePrompt = original.prepare;}
        if (manager.isPromptDisabledForActiveCharacter === disabled) {manager.isPromptDisabledForActiveCharacter = original.disabled;}
        if (manager.setChatCompletion === inspect) {manager.setChatCompletion = original.inspection;}
        if (!stateRestored) { stateRestored = true; restoreState?.(); }
    };
    const started = (_type: string, options?: { signal?: AbortSignal }) => { if (options?.signal !== captureSignal) { interrupted = true; restore(); } };
    const chatChanged = () => { interrupted = true; restore(); };
    try {
        restoreState = exposeState?.();
        manager.getPromptCollection = collection; manager.preparePrompt = prepare;
        manager.isPromptDisabledForActiveCharacter = disabled; manager.setChatCompletion = inspect;
        ctx.eventSource.on(ctx.eventTypes.CHAT_COMPLETION_PROMPT_READY, capture);
        ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, started);
        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, chatChanged);
        signal?.addEventListener('abort', restore, { once: true });
        await Generate('quiet', { signal: captureSignal }, true);
        signal?.throwIfAborted();
        if (interrupted) {throw new Error(COPY.contextBusy);}
        if (!captured || !Array.isArray(captured.chat)) {throw new Error(COPY.contextMissing);}
        let found = false;
        const strip = (text: string, tags: string[], replace: (value: string) => string = () => '') => {
            const start = text.indexOf(tags[0]);
            if (start === -1) {return text;}
            const end = text.indexOf(tags[1], start + tags[0].length);
            if (end === -1) {throw new Error(COPY.contextMissing);}
            return text.slice(0, start) + replace(text.slice(start + tags[0].length, end)) + text.slice(end + tags[1].length);
        };
        const clean = (text: string) => strip(strip(strip(text, budget), pending), passage, content => {
            if (content.trim()) {found = true;}
            return `<variable-update-target>\n${content}\n</variable-update-target>`;
        });
        const hasPending = (message: CapturedMessage) => typeof message.content === 'string' ? message.content.includes(pending[0])
            : Array.isArray(message.content) && message.content.some(part => part.type === 'text' && part.text?.includes(pending[0]));
        const messages = structuredClone(captured.chat).filter(message => !hasPending(message)).map(message => ({ ...message,
            content: typeof message.content === 'string' ? clean(message.content)
                : Array.isArray(message.content) ? message.content.map(part => part.type === 'text' && typeof part.text === 'string' ? { ...part, text: clean(part.text) } : part)
                    : message.content,
        })).filter(message => message.tool_calls?.length || (typeof message.content === 'string' ? message.content.trim() : message.content?.length));
        if (!found) {throw new Error(COPY.targetMissing);}
        return { target: { floor: target.floor, swipeId: target.swipeId }, messages };
    } finally {
        restore();
        if (ctx.groupId !== null && ctx.groupId !== undefined && ctx.chat === chat && !interrupted) { setCharacterId(ctx.characterId); setCharacterName(characterName); }
        signal?.removeEventListener('abort', restore);
        ctx.eventSource.removeListener(ctx.eventTypes.CHAT_COMPLETION_PROMPT_READY, capture);
        ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_STARTED, started);
        ctx.eventSource.removeListener(ctx.eventTypes.CHAT_CHANGED, chatChanged);
        capturing = false;
    }
}
