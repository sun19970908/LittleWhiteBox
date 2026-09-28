import { SOURCE_PAGE_CHARS } from './evidence.js';

/** Read the current source of a saved review; no writes or model tools. */
export function readMaintenanceSource({ chatId, chat, store }, request) {
    const { receiptId, floor, offset = 0, requestId } = request;
    const identity = { chatId, receiptId, requestId, floor, offset };
    const receipt = (store.summaryHistory || []).flatMap(batch => batch.maintenance || []).find(item => item.id === receiptId);
    if (request.chatId !== chatId || !receipt || !Number.isInteger(floor) || floor < 1 || floor > receipt.cutoff
        || !Number.isInteger(offset) || offset < 0 || !chat[floor - 1]) return { ...identity, status: 'unavailable' };
    const message = chat[floor - 1];
    const text = String(message.mes || '');
    if (offset > text.length) return { ...identity, status: 'unavailable' };
    const end = Math.min(offset + SOURCE_PAGE_CHARS, text.length);
    return { ...identity, status: 'ready', name: message.name || '',
        role: message.is_user ? 'user' : 'assistant', text: text.slice(offset, end),
        nextOffset: end < text.length ? end : null,
        previousFloor: floor > 1 ? floor - 1 : null, nextFloor: floor < Math.min(receipt.cutoff, chat.length) ? floor + 1 : null };
}
