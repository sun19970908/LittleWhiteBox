import { MAX_MESSAGE_IMAGE_BYTES, MESSAGE_IMAGE_MIME_TYPES } from '../../../domains/messages/image-attachment.js';
import type { ImageUpload } from '../application/image-upload.js';

/** Same FileReader → preview → multimodal flow as the assistant's attachments. */
export async function readMessageImage(file: File): Promise<ImageUpload> {
    if (!(MESSAGE_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {throw new Error('请选择 PNG、JPG、WEBP 或 GIF 图片。');}
    if (!file.size || file.size > MAX_MESSAGE_IMAGE_BYTES) {throw new Error('请选择不超过 4MB 的图片。');}
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败。'));
        reader.readAsDataURL(file);
    });
    const image = new Image(); image.src = dataUrl;
    try {await image.decode();} catch {throw new Error('这张图片无法打开，请换一张。');}
    return { dataUrl, name: file.name.replace(/[\u0000-\u001f\u007f]/gu, '').trim().slice(0, 120) || '图片' };
}
