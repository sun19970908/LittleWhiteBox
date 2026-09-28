import { getContext } from '../../../../../../extensions.js';
import { saveSillyTavernChat } from '../host/sillytavern-chat-save.js';
import { captureStoryIdentity } from '../host/story-identity.js';
import { createSillyTavernChatReader } from './sillytavern-chat-reader.js';
import type { XiaobaiOsChatBindingV1 } from '../kernel/contracts.js';
import {
    readChatMetadataHeader,
    type ChatMetadata,
    type ChatMetadataAdapter,
    type ChatMetadataCapture,
} from './chat-reference.js';

type UnknownRecord = Record<string, unknown>;

interface SillyTavernContext {
    chatId?: unknown;
    groupId?: unknown;
    characterId?: unknown;
    characters?: Record<string, { avatar?: unknown; name?: unknown }>;
    chatMetadata?: unknown;
}

interface SillyTavernChatMetadataAdapterOptions {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function context(): SillyTavernContext {
    return getContext() as unknown as SillyTavernContext;
}

function captureBinding(source: SillyTavernContext): XiaobaiOsChatBindingV1 | null {
    const identity = captureStoryIdentity(source);
    return identity ? { kind: identity.kind, ownerLocator: identity.ownerId, chatId: identity.chatId } : null;
}

function captureCurrent(): ChatMetadataCapture | null {
    const source = context();
    const binding = captureBinding(source);
    if (!binding || !isRecord(source.chatMetadata)) { return null; }
    const mainChat = source.chatMetadata.main_chat;
    return {
        identityKey: `${binding.kind}:${binding.ownerLocator}:${binding.chatId}`,
        binding,
        metadata: source.chatMetadata,
        ...(typeof mainChat === 'string' && mainChat ? { mainChatId: mainChat } : {}),
    };
}

function createSaveError(code: string, message: string, uncertain: boolean, cause?: unknown): Error {
    return Object.assign(new Error(message, { cause }), { code, uncertain });
}

export function createSillyTavernChatMetadataAdapter(
    options: SillyTavernChatMetadataAdapterOptions = {},
): ChatMetadataAdapter {
    const readChat = createSillyTavernChatReader(options);

    async function save(captured: ChatMetadataCapture, signal?: AbortSignal): Promise<void> {
        const current = captureCurrent();
        if (
            !current
            || current.identityKey !== captured.identityKey
            || current.metadata !== captured.metadata
        ) {
            throw createSaveError('CHAT_CHANGED', '保存引用前聊天已经切换', false);
        }
        if (signal?.aborted) { throw createSaveError('SAVE_ABORTED', '引用保存已取消', false, signal.reason); }
        const result = await saveSillyTavernChat(() => {
            const now = captureCurrent();
            return now?.identityKey === captured.identityKey && now.metadata === captured.metadata;
        }, signal);
        if (result.status !== 'confirmed') {
            throw createSaveError('SAVE_UNCONFIRMED', '聊天元数据未能确认保存', result.status === 'unconfirmed', result.error);
        }
    }

    async function read(binding: XiaobaiOsChatBindingV1, signal?: AbortSignal): Promise<ChatMetadata | null> {
        return readChatMetadataHeader(await readChat(binding, signal));
    }

    return Object.freeze({ capture: captureCurrent, save, read });
}
