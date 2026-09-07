import type { PromptContextInput, PromptContextSnapshot } from './types.js';

type UnknownRecord = Record<string, unknown>;

export const PROMPT_CONTEXT_LIMITS = Object.freeze({
    name: 120,
    characterKey: 160,
    characters: 16,
    recentMessages: 4,
    messageText: 4_000,
    persona: 4_000,
    characterDescription: 4_000,
    characterPersonality: 2_000,
    characterScenario: 2_000,
    worldBefore: 8_000,
    worldAfter: 8_000,
    worldDepthEntry: 2_000,
    worldDepthTotal: 8_000,
    storyEvents: 20_000,
});

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function truncatePromptText(value: string, maximum: number): string {
    return Array.from(value).slice(0, maximum).join('');
}

export function normalizePromptName(value: unknown, fallback = ''): string {
    if (typeof value !== 'string') {return fallback;}
    const normalized = value
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return truncatePromptText(normalized, PROMPT_CONTEXT_LIMITS.name) || fallback;
}

export function normalizePromptBody(value: unknown, maximum: number): string {
    if (typeof value !== 'string') {return '';}
    const normalized = value
        .normalize('NFKC')
        .replace(/\r\n?/gu, '\n')
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/gu, ' ')
        .trim();
    return truncatePromptText(normalized, maximum);
}

function normalizeKey(value: unknown): string {
    if (typeof value !== 'string') {return '';}
    const normalized = value
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return truncatePromptText(normalized, PROMPT_CONTEXT_LIMITS.characterKey);
}

function normalizeSwipeId(value: unknown): number | string | null {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value >= 0 ? value : null;
    }
    if (typeof value === 'string') {
        const normalized = normalizeKey(value);
        return normalized || null;
    }
    return null;
}

function normalizeWorldDepth(value: unknown): string[] {
    if (!Array.isArray(value)) {return [];}
    const depth: string[] = [];
    let remaining = PROMPT_CONTEXT_LIMITS.worldDepthTotal;
    for (const entry of value) {
        if (remaining <= 0) {break;}
        const normalized = normalizePromptBody(
            entry,
            Math.min(PROMPT_CONTEXT_LIMITS.worldDepthEntry, remaining),
        );
        if (!normalized) {continue;}
        depth.push(normalized);
        remaining -= Array.from(normalized).length;
    }
    return depth;
}

/** Normalizes host values into the one runtime-only prompt context shape. */
export function normalizePromptContext(value: PromptContextInput | unknown): PromptContextSnapshot {
    const source = isRecord(value) ? value : {};
    const rawPlayer = isRecord(source.player) ? source.player : {};
    const player = {
        displayName: normalizePromptName(rawPlayer.displayName, 'User'),
        persona: normalizePromptBody(rawPlayer.persona, PROMPT_CONTEXT_LIMITS.persona),
    };
    const characters = (Array.isArray(source.characters) ? source.characters : [])
        .flatMap((entry) => {
            if (!isRecord(entry)) {return [];}
            const characterKey = normalizeKey(entry.characterKey);
            if (!characterKey) {return [];}
            return [{
                characterKey,
                displayName: normalizePromptName(entry.displayName, characterKey),
                description: normalizePromptBody(entry.description, PROMPT_CONTEXT_LIMITS.characterDescription),
                personality: normalizePromptBody(entry.personality, PROMPT_CONTEXT_LIMITS.characterPersonality),
                scenario: normalizePromptBody(entry.scenario, PROMPT_CONTEXT_LIMITS.characterScenario),
            }];
        })
        .slice(0, PROMPT_CONTEXT_LIMITS.characters);
    const recentMessages = (Array.isArray(source.recentMessages) ? source.recentMessages : [])
        .flatMap((entry) => {
            if (!isRecord(entry) || (entry.role !== 'user' && entry.role !== 'assistant')) {return [];}
            if (!Number.isSafeInteger(entry.index) || Number(entry.index) < 0) {return [];}
            const text = normalizePromptBody(entry.text, PROMPT_CONTEXT_LIMITS.messageText);
            if (!text) {return [];}
            return [{
                index: Number(entry.index),
                role: entry.role as 'user' | 'assistant',
                speakerName: normalizePromptName(entry.speakerName, entry.role === 'user' ? 'User' : 'Assistant'),
                text,
                swipeId: normalizeSwipeId(entry.swipeId),
            }];
        })
        .sort((left, right) => left.index - right.index)
        .slice(-PROMPT_CONTEXT_LIMITS.recentMessages);
    const rawWorldInfo = isRecord(source.worldInfo) ? source.worldInfo : {};
    const worldInfo = {
        before: normalizePromptBody(rawWorldInfo.before, PROMPT_CONTEXT_LIMITS.worldBefore),
        after: normalizePromptBody(rawWorldInfo.after, PROMPT_CONTEXT_LIMITS.worldAfter),
        depth: normalizeWorldDepth(rawWorldInfo.depth),
    };
    const storyEvents = normalizePromptBody(source.storyEvents, PROMPT_CONTEXT_LIMITS.storyEvents);
    return { player, characters, recentMessages, worldInfo, storyEvents };
}
