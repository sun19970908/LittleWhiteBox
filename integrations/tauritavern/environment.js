/**
 * Reads the TauriTavern ownership decision once for the current page.
 * Missing or older host APIs are ordinary static-renderer environments.
 */
export function inspectTauriTavernEnvironment(host) {
    const isTauriTavern = Boolean(host);
    const api = host?.api?.chatSurface;
    if (typeof api?.isManagedOwnershipRequired !== 'function') {
        return Object.freeze({ isTauriTavern, managed: false, api: null });
    }

    const managed = api.isManagedOwnershipRequired() === true;
    return Object.freeze({ isTauriTavern, managed, api: managed ? api : null });
}

const environment = inspectTauriTavernEnvironment(globalThis.window?.__TAURITAVERN__);

export function getTauriTavernEnvironment() {
    return environment;
}

export function isTauriTavernChatSurfaceManaged() {
    return environment.managed;
}
