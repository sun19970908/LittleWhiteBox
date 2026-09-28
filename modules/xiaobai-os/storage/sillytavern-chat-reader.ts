import { getContext } from '../../../../../../extensions.js';
import { getRequestHeaders } from '../../../../../../../script.js';
import type { XiaobaiOsChatBindingV1 } from '../kernel/contracts.js';

export interface SillyTavernChatReaderOptions { fetch?: typeof globalThis.fetch; timeoutMs?: number }

/** Shared native read protocol. Consumers own validation/projection of the returned chat. */
export function createSillyTavernChatReader(options: SillyTavernChatReaderOptions = {}) {
    const request = options.fetch ?? globalThis.fetch.bind(globalThis);
    return async (binding: XiaobaiOsChatBindingV1, signal?: AbortSignal): Promise<unknown | null> => {
        const source = getContext() as unknown as { characters?: Record<string, { avatar?: unknown; name?: unknown }> };
        let endpoint: string;
        let body: Record<string, unknown>;
        if (binding.kind === 'group') {
            endpoint = '/api/chats/group/get'; body = { id: binding.chatId };
        } else {
            const character = Object.values(source.characters ?? {}).find(item => item?.avatar === binding.ownerLocator);
            if (!character) { return null; }
            endpoint = '/api/chats/get';
            body = { ch_name: String(character.name || ''), file_name: binding.chatId, avatar_url: character.avatar };
        }
        const controller = new AbortController();
        const forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener('abort', forwardAbort, { once: true });
        if (signal?.aborted) { controller.abort(signal.reason); }
        const timer = options.timeoutMs && options.timeoutMs > 0 ? globalThis.setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
        try {
            const response = await request(endpoint, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body),
                cache: 'no-store', signal: controller.signal });
            if (response.status === 404) { return null; }
            if (!response.ok) { throw new Error(`chat_read_http_${response.status}`); }
            return await response.json();
        } finally {
            if (timer !== undefined) { globalThis.clearTimeout(timer); }
            signal?.removeEventListener('abort', forwardAbort);
        }
    };
}
