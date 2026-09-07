import type {
    TaskGenerationContext,
    TaskGenerationContextInput,
} from './types.js';
import {
    normalizePromptContext,
} from '../../../host/prompt-context/normalize.js';
import { worldContent } from '../../../domains/world/projection.js';

const MAX_MAP_CONTEXT_CHARACTERS = 800;

function normalizeMapContext(value: unknown): string {
    if (typeof value !== 'string') {return '';}
    const normalized = value.replace(/\r\n?/gu, '\n').trim();
    if (
        !normalized.startsWith('<current_map>')
        || !normalized.endsWith('</current_map>')
        || Array.from(normalized).length > MAX_MAP_CONTEXT_CHARACTERS
        || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(normalized)
    ) {
        return '';
    }
    return normalized;
}

/** Normalizes raw host fields and copies the validated World capability projection. */
export function normalizeTaskGenerationContext(value: TaskGenerationContextInput): TaskGenerationContext {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    return {
        ...normalizePromptContext(source),
        mapContext: normalizeMapContext(source.mapContext),
        worldContent: source.worldContent === undefined || source.worldContent === null
            ? null : worldContent(source.worldContent),
    };
}
