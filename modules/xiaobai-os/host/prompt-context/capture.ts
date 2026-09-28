import { countAssistantTurns } from '../assistant-turn-count.js';
import { captureStoryIdentity } from '../story-identity.js';
import { selectPromptCharacters } from './character-source.js';
import { normalizePromptContext, type PromptContextLimitOverrides } from './normalize.js';
import type {
    PromptContextAdapter,
    PromptContextCapture,
    PromptContextCaptureOptions,
    PromptContextInput,
} from './types.js';

type UnknownRecord = Record<string, unknown>;

interface HostMessage {
    readonly name?: unknown;
    readonly is_user?: unknown;
    readonly is_system?: unknown;
    readonly mes?: unknown;
    readonly swipe_id?: unknown;
}

export interface PromptHostContext {
    readonly chatId?: unknown;
    readonly groupId?: unknown;
    readonly characterId?: unknown;
    readonly characters?: unknown;
    readonly groups?: unknown;
    readonly name1?: unknown;
    readonly name2?: unknown;
    readonly chat?: unknown;
    readonly maxContext?: unknown;
    readonly worldInfoIncludeNames?: unknown;
    readonly powerUserSettings?: unknown;
    readonly getCharacterCardFields?: () => unknown;
    readonly getWorldInfoPrompt?: (
        messages: string[],
        tokenBudget: number,
        dryRun: boolean,
        globalScanData?: UnknownRecord,
    ) => unknown | Promise<unknown>;
}

export interface HostPromptContextAdapterDependencies {
    readonly readContext: () => PromptHostContext;
    readonly readStoryEvents: (throughMessageIndex: number) => string | Promise<string>;
    readonly cleanMessageText?: (text: string) => string;
    readonly report?: (error: unknown) => void;
    readonly normalizationLimits?: PromptContextLimitOverrides;
    readonly includeActiveStoryDetails?: boolean;
    readonly strictBackgroundRead?: boolean;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function chatIdentity(context: PromptHostContext): string {
    return captureStoryIdentity(context)?.key ?? '';
}

function ordinaryMessages(context: PromptHostContext, throughMessageIndex: number) {
    const chat = Array.isArray(context.chat) ? context.chat : [];
    return chat.slice(0, throughMessageIndex + 1).flatMap((value, index) => {
        if (!isRecord(value)) {return [];}
        const message = value as HostMessage;
        if (message.is_system === true) {return [];}
        const role = message.is_user === true ? 'user' as const : 'assistant' as const;
        return [{
            index,
            role,
            speakerName: message.name ?? (role === 'user' ? context.name1 : context.name2),
            text: message.mes,
            swipeId: message.swipe_id ?? null,
        }];
    });
}

function promptScanData(context: PromptHostContext, report: (error: unknown) => void, activeFields?: UnknownRecord): UnknownRecord {
    let fields: UnknownRecord = activeFields ?? {};
    if (!activeFields && typeof context.getCharacterCardFields === 'function') {
        try {
            const value = context.getCharacterCardFields();
            if (isRecord(value)) {fields = value;}
        } catch (error) {
            report(error);
        }
    }
    const settings = isRecord(context.powerUserSettings) ? context.powerUserSettings : {};
    const text = (value: unknown): string => typeof value === 'string' ? value : '';
    return {
        personaDescription: text(fields.persona) || text(settings.persona_description),
        characterDescription: text(fields.description),
        characterPersonality: text(fields.personality),
        characterDepthPrompt: text(fields.charDepthPrompt),
        scenario: text(fields.scenario),
        creatorNotes: text(fields.creatorNotes),
        trigger: 'normal',
    };
}

export function createHostPromptContextAdapter({
    readContext,
    readStoryEvents,
    cleanMessageText,
    normalizationLimits,
    includeActiveStoryDetails = false,
    strictBackgroundRead = false,
    report = () => undefined,
}: HostPromptContextAdapterDependencies): PromptContextAdapter {
    function currentChatIdentity(): string {
        return chatIdentity(readContext());
    }

    async function capture(options: PromptContextCaptureOptions = {}): Promise<PromptContextCapture> {
        const context = readContext();
        const identity = chatIdentity(context);
        if (!identity) {throw new Error('prompt_context_chat_unavailable');}
        const chat = Array.isArray(context.chat) ? context.chat : [];
        const through = options.throughMessageIndex ?? chat.length - 1;
        if (!Number.isSafeInteger(through) || through < -1 || through >= chat.length) {
            throw new Error('prompt_context_boundary_invalid');
        }
        const recentBefore = options.recentBeforeIndex ?? through + 1;
        if (!Number.isSafeInteger(recentBefore) || recentBefore < 0 || recentBefore > through + 1) {
            throw new Error('prompt_context_recent_boundary_invalid');
        }
        const excluded = new Set(options.excludeMessageIndices ?? []);
        const messages = ordinaryMessages(context, through).filter(message => !excluded.has(message.index))
            .map(message => cleanMessageText ? { ...message, text: cleanMessageText(String(message.text ?? '')) } : message);
        const recentMessages = messages.filter(message => message.index < recentBefore);
        let activeFields: UnknownRecord | undefined;
        if (includeActiveStoryDetails) {
            if (typeof context.getCharacterCardFields !== 'function') {
                throw new Error('prompt_context_character_fields_unavailable');
            }
            let fields: unknown;
            try {fields = context.getCharacterCardFields();}
            catch (cause) {throw new Error('prompt_context_character_fields_failed', { cause });}
            if (!isRecord(fields) || typeof fields.mesExamples !== 'string'
                || ['persona', 'description', 'personality', 'scenario', 'charDepthPrompt']
                    .some(field => fields[field] !== undefined && typeof fields[field] !== 'string')) {
                throw new Error('prompt_context_character_fields_unavailable');
            }
            activeFields = fields;
        }
        const baseInput: PromptContextInput = {
            player: {
                displayName: context.name1,
                persona: activeFields ? activeFields.persona : isRecord(context.powerUserSettings)
                    ? context.powerUserSettings.persona_description
                    : '',
            },
            characters: selectPromptCharacters(context, activeFields),
            ...(activeFields ? { exampleDialogue: activeFields.mesExamples,
                characterNote: activeFields.charDepthPrompt } : {}),
            recentMessages,
            worldInfo: { before: '', after: '', depth: [] },
            storyEvents: '',
        };
        const [worldInfo, storyEvents] = await Promise.all([
            (async (): Promise<PromptContextInput['worldInfo']> => {
                if (options.includeWorldInfo === false) {
                    return { before: '', after: '', depth: [] };
                }
                if (typeof context.getWorldInfoPrompt !== 'function') {
                    if (strictBackgroundRead) {throw new Error('prompt_context_world_info_unavailable');}
                    return { before: '', after: '', depth: [] };
                }
                const includeNames = context.worldInfoIncludeNames === true;
                const scanChat = [...options.worldInfoScanMessages ?? [], ...messages.map((message) => {
                    const text = String(message.text || '');
                    return includeNames ? `${message.speakerName}: ${text}` : text;
                }).reverse()];
                const globalScanData = promptScanData(context, report, activeFields);
                const hostMaxContext = Number(context.maxContext);
                const worldInfoContext = Number.isFinite(hostMaxContext) && hostMaxContext > 0
                    ? Math.floor(hostMaxContext)
                    : 8_192;
                try {
                    const value = await context.getWorldInfoPrompt(scanChat, worldInfoContext, true, globalScanData);
                    if (!isRecord(value)) {throw new Error('prompt_context_world_info_invalid');}
                    const result = value;
                    if (strictBackgroundRead && (typeof result.worldInfoBefore !== 'string'
                        || typeof result.worldInfoAfter !== 'string' || !Array.isArray(result.worldInfoDepth)
                        || !Array.isArray(result.worldInfoExamples) || !Array.isArray(result.anBefore)
                        || !Array.isArray(result.anAfter)
                        || !result.worldInfoDepth.every(entry => isRecord(entry) && Array.isArray(entry.entries)
                            && entry.entries.every(item => typeof item === 'string'))
                        || !result.worldInfoExamples.every(entry => isRecord(entry)
                            && (entry.position === 0 || entry.position === 1) && typeof entry.content === 'string')
                        || !result.anBefore.every(item => typeof item === 'string')
                        || !result.anAfter.every(item => typeof item === 'string'))) {
                        throw new Error('prompt_context_world_info_invalid');
                    }
                    const depth = Array.isArray(result.worldInfoDepth)
                        ? result.worldInfoDepth.flatMap((entry) => {
                            if (!isRecord(entry) || !Array.isArray(entry.entries)) {return [];}
                            return entry.entries.filter(item => typeof item === 'string');
                        })
                        : [];
                    const examples = Array.isArray(result.worldInfoExamples) ? result.worldInfoExamples.filter(isRecord) : [];
                    const notes = (value: unknown) => Array.isArray(value)
                        ? value.filter((item): item is string => typeof item === 'string') : [];
                    return { before: result.worldInfoBefore, after: result.worldInfoAfter, depth,
                        ...(includeActiveStoryDetails ? { extras: {
                            // SillyTavern 1.18 wi_anchor_position: before=0, after=1.
                            exampleBefore: examples.filter(item => item.position === 0).map(item => item.content),
                            exampleAfter: examples.filter(item => item.position === 1).map(item => item.content),
                            authorNoteBefore: notes(result.anBefore), authorNoteAfter: notes(result.anAfter),
                        } } : {}),
                    };
                } catch (error) {
                    if (strictBackgroundRead) {throw new Error('prompt_context_world_info_failed', { cause: error });}
                    report(error);
                    return { before: '', after: '', depth: [] };
                }
            })(),
            (async () => {
                if (through < 0) {return '';}
                try {
                    const events = await readStoryEvents(through);
                    if (strictBackgroundRead && typeof events !== 'string') {
                        throw new Error('prompt_context_story_events_invalid');
                    }
                    return events;
                }
                catch (error) {
                    if (strictBackgroundRead) {throw new Error('prompt_context_story_events_failed', { cause: error });}
                    report(error); return '';
                }
            })(),
        ]);
        if (currentChatIdentity() !== identity) {throw new Error('prompt_context_chat_changed');}
        return {
            chatIdentity: identity,
            assistantCount: countAssistantTurns(chat, through + 1),
            contextSnapshot: normalizePromptContext({ ...baseInput, worldInfo, storyEvents }, normalizationLimits),
        };
    }

    return Object.freeze({ currentChatIdentity, capture });
}
