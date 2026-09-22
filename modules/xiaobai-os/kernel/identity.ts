/** Storage identifiers also work on LAN HTTP (randomUUID requires a secure context). */
export function createStorageId(): string {
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
