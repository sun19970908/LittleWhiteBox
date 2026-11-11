import { lodash } from '../../../../../../lib.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import { getRequestHeaders, saveChat, saveSettings } from '../../../../../../script.js';
import { saveGroupChat, editGroup } from '../../../../../group-chats.js';
import { PANEL_COPY } from './variables-panel-copy.js';

const read = async (url, body) => {
    const response = await fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), cache: 'no-store' });
    if (!response.ok) throw new Error(`${PANEL_COPY.unconfirmed} (HTTP ${response.status})`);
    return response.json();
};

// Invoke the native immediate saver before yielding: unlike ctx.saveChat(), it
// captures the destination and request body now, not after a chat-saving wait.
export async function savePanelVariables(type) {
    const ctx = getContext();
    const expected = structuredClone(type === 'global' ? extension_settings.variables?.global || {} : ctx.chatMetadata.variables || {});
    let actual;
    if (type === 'global') {
        await saveSettings();
        const saved = await read('/api/settings/get', {});
        actual = JSON.parse(saved.settings).extension_settings?.variables?.global || {};
    } else {
        if (!ctx.chatId) throw new Error(PANEL_COPY.missingChat);
        const group = ctx.groupId != null;
        const character = ctx.characters[ctx.characterId];
        const destination = group ? { id: ctx.chatId } : { ch_name: character.name, file_name: character.chat, avatar_url: character.avatar };
        const groupId = ctx.groupId, chatId = ctx.chatId;
        if (group) {
            // 1.14 stores metadata in the group record; 1.18 stores it in the
            // chat header. Both native saves capture their inputs synchronously.
            await Promise.all([saveGroupChat(groupId, false), editGroup(groupId, true, false)]);
        } else {
            await saveChat();
        }
        const saved = await read(group ? '/api/chats/group/get' : '/api/chats/get', destination);
        if (group && !saved[0]?.chat_metadata) {
            const groups = await read('/api/groups/all', {});
            const savedGroup = groups.find(item => item.id === groupId);
            actual = (savedGroup?.chat_id === chatId ? savedGroup.chat_metadata : savedGroup?.past_metadata?.[chatId])?.variables || {};
        } else actual = saved[0]?.chat_metadata?.variables || {};
    }
    if (!lodash.isEqual(actual, expected)) throw new Error(PANEL_COPY.unconfirmed);
}
