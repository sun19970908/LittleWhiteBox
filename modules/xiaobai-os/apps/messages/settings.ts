import type { MessagesSettings } from './types.js';

/** User preferences are normalized only when the OS settings are prepared. */
export function normalizeMessagesSettings(value: unknown): MessagesSettings {
    const settings = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    return { imagePrompt: settings.imagePrompt === true, voicePrompt: settings.voicePrompt === true };
}
