/** Learning IDs must also work on LAN HTTP, where randomUUID is unavailable. */
export function createLearningId(): string {
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
