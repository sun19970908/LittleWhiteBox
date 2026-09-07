import { MESSAGE_IMAGE_FOLDER, MAX_MESSAGE_IMAGE_BYTES, parseImageAttachment, type MessageImageAttachment } from '../../../domains/messages/image-attachment.js';
import { parseImageUpload, uploadedImageReference, type ImageUpload } from '../application/image-upload.js';

export function createMessageImages(uploadFile: (data: string, folder: string, name: string, format: string) => Promise<string>, read = fetch) {
    async function save(input: ImageUpload, signal: AbortSignal): Promise<MessageImageAttachment> {
        const upload = parseImageUpload(input);
        const attachment = uploadedImageReference(upload);
        const filename = attachment.path.split('/').at(-1)!;
        const [name, format] = filename.split('.');
        signal.throwIfAborted();
        const path = await uploadFile(upload.dataUrl.slice(upload.dataUrl.indexOf(',') + 1), MESSAGE_IMAGE_FOLDER, name, format);
        signal.throwIfAborted();
        if (path !== attachment.path) {throw new Error('messages_image_save_failed');}
        return attachment;
    }
    async function load(input: MessageImageAttachment, signal: AbortSignal): Promise<string> {
        const attachment = parseImageAttachment(input);
        const response = await read(attachment.path, { signal, redirect: 'error' });
        if (!response.ok) {throw new Error('messages_image_missing');}
        const blob = await response.blob();
        if (!blob.size || blob.size > MAX_MESSAGE_IMAGE_BYTES) {throw new Error('messages_invalid_image');}
        const bytes = new Uint8Array(await blob.arrayBuffer());
        signal.throwIfAborted();
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) {binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));}
        const format = attachment.path.split('.').at(-1)!;
        return `data:image/${format};base64,${btoa(binary)}`;
    }
    return { save, load };
}

export type MessageImages = ReturnType<typeof createMessageImages>;
