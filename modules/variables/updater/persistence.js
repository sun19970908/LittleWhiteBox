import { getRequestHeaders } from '../../../../../../../script.js';
import { RECORD_KEY } from '../state2/records.js';
import { COPY } from './copy.js';

// The host catches save errors internally. Confirm our record in the captured
// chat, rather than interpreting its resolved promise as a save receipt.
export async function saveUpdate(ctx, target, signal) {
    const character = ctx.characters?.[ctx.characterId];
    const group = ctx.groupId != null;
    const body = group ? { id: ctx.chatId } : {
        ch_name: character.name, file_name: character.chat, avatar_url: character.avatar,
    };
    const expected = JSON.stringify(target.message.extra?.[RECORD_KEY]);
    const expectedState = JSON.stringify([ctx.chatMetadata.variables, ctx.chatMetadata.LWB_RULES_V2]);
    await ctx.saveChat();
    signal?.throwIfAborted();
    const response = await fetch(group ? '/api/chats/group/get' : '/api/chats/get', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error(`${COPY.saveUnconfirmed} (HTTP ${response.status})`);
    const saved = await response.json();
    const message = saved[target.floor + 1];
    if (message?.mes !== target.message.mes || (message.swipe_id ?? 0) !== target.swipeId
        || JSON.stringify(message.extra?.[RECORD_KEY]) !== expected
        || JSON.stringify([saved[0]?.chat_metadata?.variables, saved[0]?.chat_metadata?.LWB_RULES_V2]) !== expectedState) throw new Error(COPY.saveUnconfirmed);
}
