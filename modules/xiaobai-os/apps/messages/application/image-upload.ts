import { sha256 } from 'js-sha256';
import { messageString, record } from '../../../domains/messages/invariants.js';
import { MESSAGE_IMAGE_FOLDER, MAX_MESSAGE_IMAGE_BYTES, type MessageImageAttachment } from '../../../domains/messages/image-attachment.js';

export interface ImageUpload { dataUrl: string; name: string }
export type OutgoingMessage = { type: 'text'; text: string } | { type: 'image'; description: string; upload: ImageUpload };

export function parseImageUpload(value: unknown): ImageUpload {
    if (!record(value) || Object.keys(value).some(key => key !== 'dataUrl' && key !== 'name') || typeof value.dataUrl !== 'string'
        || value.dataUrl.length > 64 + 4 * Math.ceil(MAX_MESSAGE_IMAGE_BYTES / 3)) {throw new Error('messages_invalid_image');}
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value.dataUrl);
    if (!match || match[2].length % 4 !== 0) {throw new Error('messages_invalid_image');}
    const size = match[2].length / 4 * 3 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
    if (size === 0 || size > MAX_MESSAGE_IMAGE_BYTES) {throw new Error('messages_invalid_image');}
    return { dataUrl: value.dataUrl, name: messageString(value.name, 120).trim() };
}

export function uploadedImageReference(upload: ImageUpload): MessageImageAttachment {
    const format = upload.dataUrl.slice('data:image/'.length, upload.dataUrl.indexOf(';'));
    return { path: `/user/images/${MESSAGE_IMAGE_FOLDER}/${sha256(upload.dataUrl)}.${format}`, name: upload.name };
}

/** The sending UI accepts files and text, never generated-media instructions. */
export function parseOutgoingMessage(value: unknown): OutgoingMessage {
    if (!record(value)) {throw new Error('messages_invalid_payload');}
    if (value.type === 'text' && Object.keys(value).every(key => ['type', 'text'].includes(key))) {
        return { type: 'text', text: messageString(value.text, 4000) };
    }
    if (value.type === 'image' && Object.keys(value).every(key => ['type', 'description', 'upload'].includes(key))) {
        return { type: 'image', description: messageString(value.description ?? '', 4000, true), upload: parseImageUpload(value.upload) };
    }
    throw new Error('messages_invalid_payload');
}
