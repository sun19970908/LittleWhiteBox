import { ADMINISTRATOR_POLICY } from '../domain/policy.js';
import { object, parseAdministratorData } from '../domain/data.js';
import type { AdministratorData, AdministratorImage } from '../domain/types.js';
import { createAdministratorId } from '../application/identity.js';

export interface AdministratorUpload { name: string; dataUrl: string }
const SAFE_ID = /^[A-Za-z0-9_-]+$/u;
const IMAGE_FILE = /^[A-Za-z0-9_-]+\.(png|jpeg|webp|gif)$/u;
export function administratorImageFolder(osId: string) {
    if (!SAFE_ID.test(osId)) { throw new Error('administrator_image_owner_invalid'); }
    return `xb-os-admin-${osId}`;
}
export function parseAdministratorUpload(raw: unknown): AdministratorUpload {
    const value = object(raw);
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || typeof value.dataUrl !== 'string'
        || value.dataUrl.length > 64 + 4 * Math.ceil(ADMINISTRATOR_POLICY.maxImageBytes / 3)) { throw new Error('administrator_invalid_image'); }
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value.dataUrl);
    if (!match || match[2].length % 4 || match[2].length / 4 * 3 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0) > ADMINISTRATOR_POLICY.maxImageBytes) { throw new Error('administrator_invalid_image'); }
    return { name: value.name, dataUrl: value.dataUrl };
}
export function administratorAttachments(data: AdministratorData): AdministratorImage[] {
    return data.turns.flatMap(turn => turn.user?.image ? [turn.user.image] : []);
}

export function createAdministratorImages(options: {
    upload(data: string, folder: string, name: string, format: string): Promise<string>;
    headers(): Record<string, string>;
    read?: typeof fetch;
    id?: () => string;
}) {
    const request = options.read ?? fetch;
    const id = options.id ?? createAdministratorId;
    function ownedPath(osId: string, path: string) {
        const prefix = `/user/images/${administratorImageFolder(osId)}/`;
        if (!path.startsWith(prefix) || !IMAGE_FILE.test(path.slice(prefix.length))) { throw new Error('administrator_image_owner_mismatch'); }
        return path;
    }
    async function save(osId: string, value: AdministratorUpload): Promise<AdministratorImage> {
        const input = parseAdministratorUpload(value);
        const format = input.dataUrl.slice(11, input.dataUrl.indexOf(';'));
        const name = id();
        if (!SAFE_ID.test(name)) { throw new Error('administrator_image_id_invalid'); }
        const path = `/user/images/${administratorImageFolder(osId)}/${name}.${format}`;
        const result = await options.upload(input.dataUrl.slice(input.dataUrl.indexOf(',') + 1), administratorImageFolder(osId), name, format);
        if (result !== path) { throw new Error('administrator_image_save_failed'); }
        return { name: input.name, path };
    }
    async function load(osId: string, image: AdministratorImage, signal?: AbortSignal): Promise<string> {
        const response = await request(ownedPath(osId, image.path), { signal, redirect: 'error' });
        if (!response.ok) { throw new Error('administrator_image_missing'); }
        const blob = await response.blob();
        if (!blob.size || blob.size > ADMINISTRATOR_POLICY.maxImageBytes) { throw new Error('administrator_invalid_image'); }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let start = 0; start < bytes.length; start += 8192) { binary += String.fromCharCode(...bytes.subarray(start, start + 8192)); }
        signal?.throwIfAborted();
        return `data:image/${image.path.split('.').at(-1)};base64,${btoa(binary)}`;
    }
    async function remove(osId: string, image: AdministratorImage) {
        const path = ownedPath(osId, image.path);
        const response = await request('/api/images/delete', { method: 'POST', headers: options.headers(), body: JSON.stringify({ path: path.slice(1) }) });
        if (!response.ok && response.status !== 404) { throw new Error('administrator_image_delete_failed'); }
    }
    async function clear(osId: string) {
        const folder = administratorImageFolder(osId);
        const response = await request('/api/images/list', { method: 'POST', headers: options.headers(), body: JSON.stringify({ folder }) });
        if (!response.ok) { throw new Error('administrator_image_list_failed'); }
        const names: unknown = await response.json();
        if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !IMAGE_FILE.test(name))) { throw new Error('administrator_image_list_invalid'); }
        for (const name of names) { await remove(osId, { name, path: `/user/images/${folder}/${name}` }); }
    }
    async function clonePartition(sourceId: string, targetId: string, raw: unknown) {
        let data: AdministratorData;
        try { data = parseAdministratorData(raw); }
        catch (error) {
            if ((error as Error).message !== 'administrator_data_invalid') { throw error; }
            // Retain the damaged payload for the APP's explicit repair UI; it must not block cloning other APPs.
            // No attachment can be read or removed through an invalid record or a different owner's folder.
            return structuredClone(raw);
        }
        try {
            for (const turn of data.turns) {
                if (!turn.user?.image) { continue; }
                turn.user.image = await save(targetId, { name: turn.user.image.name, dataUrl: await load(sourceId, turn.user.image) });
            }
            return data;
        } catch (error) {
            try { await clear(targetId); } catch (cleanup) { throw new AggregateError([error, cleanup], 'administrator_image_copy_cleanup_failed'); }
            throw error;
        }
    }
    return { save, load, remove, clear, clonePartition };
}
export type AdministratorImages = ReturnType<typeof createAdministratorImages>;
