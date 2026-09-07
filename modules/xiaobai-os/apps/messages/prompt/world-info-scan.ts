import { payloadText, type MessageContact, type PrivateMessage } from '../../../domains/messages/types.js';

/**
 * Match the active conversation, not other contacts' private knowledge. The
 * host still owns keyword/depth/budget rules; no entry-name or UID lookup.
 */
export function privateMessageScan(contact: MessageContact, history: PrivateMessage[], incoming: PrivateMessage): string[] {
    const lines = [`${contact.name}${contact.note ? `（${contact.note}）` : ''}\n${incoming.from}: ${payloadText(incoming.payload)}`];
    let remaining = 18000;
    for (const message of [...history].reverse()) {
        const line = `${message.from}: ${payloadText(message.payload)}`;
        if (line.length > remaining) {break;}
        lines.push(line); remaining -= line.length;
    }
    return lines;
}
