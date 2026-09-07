import type { FourthWallGenerationResult, FourthWallProjection, FourthWallThought } from '../types.js';

function extractTaggedMessages(text: unknown): string {
    const source = String(text || '');
    const expression = /<msg\b[^>]*>([\s\S]*?)<\/msg>/gi;
    const parts = [];
    let match: RegExpExecArray | null;
    while ((match = expression.exec(source)) !== null) {
        const value = String(match[1] || '').trim();
        if (value) {
            parts.push(value);
        }
    }
    return parts.join('\n').trim();
}

function extractPartialMessage(text: unknown): string {
    const source = String(text || '');
    const openIndex = source.toLowerCase().lastIndexOf('<msg');
    if (openIndex < 0) {
        return '';
    }
    const contentIndex = source.indexOf('>', openIndex);
    if (contentIndex < 0) {
        return '';
    }
    const remainder = source.slice(contentIndex + 1);
    const closeIndex = remainder.toLowerCase().indexOf('</msg>');
    return (closeIndex < 0 ? remainder : remainder.slice(0, closeIndex)).trim();
}

function formatThoughts(thoughts: FourthWallGenerationResult['thoughts']): string {
    if (!Array.isArray(thoughts)) {
        return '';
    }
    return thoughts
        .map((item) => {
            if (typeof item === 'string') {
                return item.trim();
            }
            if (!item || typeof item !== 'object') {
                return '';
            }
            const thought: FourthWallThought = item;
            const label = String(thought.label || '').trim();
            const text = String(thought.text || '').trim();
            return text && label ? `【${label}】\n${text}` : text;
        })
        .filter(Boolean)
        .join('\n\n');
}

function extractThinking(text: unknown): string {
    const source = String(text || '');
    const messageIndex = source.toLowerCase().indexOf('<msg');
    const thinkingSource = messageIndex < 0 ? source : source.slice(0, messageIndex);
    const tagged = thinkingSource.match(/<(?:think|thinking)\b[^>]*>([\s\S]*?)(?:<\/(?:think|thinking)>|$)/i);
    if (tagged) {
        return String(tagged[1] || '').trim();
    }
    return messageIndex > 0 ? thinkingSource.trim() : '';
}

function stripThinkingBlocks(text: string): string {
    return text
        .replace(/<(?:think|thinking)\b[^>]*>[\s\S]*?(?:<\/(?:think|thinking)>|$)/gi, '')
        .trim();
}

export function projectGenerationProgress(result: FourthWallGenerationResult = {}): FourthWallProjection {
    const rawText = String(result.text || '');
    return {
        text: extractTaggedMessages(rawText) || extractPartialMessage(rawText) || stripThinkingBlocks(rawText),
        thinking: extractThinking(rawText) || formatThoughts(result.thoughts),
    };
}

export function projectGenerationResult(result: FourthWallGenerationResult = {}): FourthWallProjection {
    const rawText = String(result.text || '');
    return {
        text:
            extractTaggedMessages(rawText) ||
            extractPartialMessage(rawText) ||
            stripThinkingBlocks(rawText) ||
            '(no response)',
        thinking: extractThinking(rawText) || formatThoughts(result.thoughts),
    };
}
