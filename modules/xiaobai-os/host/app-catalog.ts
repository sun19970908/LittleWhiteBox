import appIds from './app-catalog.json';
import type { XiaobaiOsAppModule } from '../kernel/app-registry.js';

export const XIAOBAI_OS_HOST_APP_IDS: readonly string[] = Object.freeze([...appIds]);

export function createHostAppCatalog(modules: readonly XiaobaiOsAppModule[]): readonly XiaobaiOsAppModule[] {
    const byId = new Map<string, XiaobaiOsAppModule>();
    for (const module of modules) {
        const id = String(module?.descriptor?.id || '');
        if (!XIAOBAI_OS_HOST_APP_IDS.includes(id)) { throw new Error(`unexpected_host_app:${id}`); }
        if (byId.has(id)) { throw new Error(`duplicate_host_app:${id}`); }
        byId.set(id, module);
    }
    const missing = XIAOBAI_OS_HOST_APP_IDS.filter(id => !byId.has(id));
    if (missing.length > 0) { throw new Error(`missing_host_apps:${missing.join(',')}`); }
    return Object.freeze(XIAOBAI_OS_HOST_APP_IDS.map(id => byId.get(id) as XiaobaiOsAppModule));
}
