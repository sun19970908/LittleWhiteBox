import type { XiaobaiOsChatIdentity } from '../types.js';

export interface StoryIdentityContext {
    readonly chatId?: unknown;
    readonly groupId?: unknown;
    readonly characterId?: unknown;
    readonly characters?: unknown;
}

/** Use the same stable owner locator as the chat reference stored on disk. */
export function captureStoryIdentity(context: StoryIdentityContext): XiaobaiOsChatIdentity | null {
    const chatId = typeof context.chatId === 'string' ? context.chatId : '';
    if (!chatId) {return null;}
    const groupId = context.groupId === null || context.groupId === undefined ? '' : String(context.groupId);
    const characterId = context.characterId === null || context.characterId === undefined ? '' : String(context.characterId);
    const characters = context.characters as Record<string, { avatar?: unknown }> | undefined;
    const kind = groupId ? 'group' : 'character';
    const ownerId = groupId || (typeof characters?.[characterId]?.avatar === 'string'
        ? characters[characterId].avatar : '');
    if (!ownerId) {return null;}
    return Object.freeze({ key: `${kind}:${ownerId}:${chatId}`, kind, ownerId, chatId });
}
