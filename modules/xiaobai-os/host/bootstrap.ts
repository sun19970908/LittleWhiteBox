import type { AppModuleRegistry } from '../kernel/app-registry.js';
import type { AppStatus } from '../kernel/execution-scope.js';
import type { XiaobaiOsAppRuntimeRouter } from '../types.js';
import {
    createXiaobaiOsLifecycle,
    type XiaobaiOsLifecycle,
    type XiaobaiOsLifecycleOptions,
} from './lifecycle.js';

export interface XiaobaiOsKernelComposition {
    apps: AppModuleRegistry;
    install(): Promise<void>;
    dispose(): Promise<void>;
}

export interface XiaobaiOsBootstrapOptions extends Omit<
    XiaobaiOsLifecycleOptions,
    'appRuntime' | 'getAppDescriptors' | 'getAppStatuses' | 'subscribeAppStatusChanged'
> {
    composition: XiaobaiOsKernelComposition;
}

export interface XiaobaiOsBootstrap {
    lifecycle: XiaobaiOsLifecycle;
    init(): Promise<boolean>;
    cleanup(): Promise<void>;
}

function createModuleRouter(apps: AppModuleRegistry): XiaobaiOsAppRuntimeRouter {
    return Object.freeze({
        getDescriptors: apps.descriptors,
        activate: apps.activate,
        deactivate: apps.deactivate,
        handleMessage: apps.handleMessage,
        retry: apps.retry,
        cancelForeground: apps.cancelForeground,
        cancelAll: apps.cancelAll,
        handleWindowOpened: apps.handleWindowOpened,
        handleWindowClosed: apps.handleWindowClosed,
        handleChatChanged: apps.handleChatChanged,
        startBackground: apps.startBackground,
        stopBackground: apps.stopBackground,
    });
}

export function createXiaobaiOsBootstrap(options: XiaobaiOsBootstrapOptions): XiaobaiOsBootstrap {
    const { composition, ...lifecycleOptions } = options;
    const appRuntime = createModuleRouter(composition.apps);
    const lifecycle = createXiaobaiOsLifecycle({
        ...lifecycleOptions,
        appRuntime,
        getAppDescriptors: appRuntime.getDescriptors,
        getAppStatuses: composition.apps.statuses,
        subscribeAppStatusChanged(listener: (appId: string, status: AppStatus) => void) {
            return composition.apps.subscribe(listener);
        },
    });
    let initPromise: Promise<boolean> | null = null;
    let cleanupPromise: Promise<void> | null = null;
    let installed = false;

    async function init(): Promise<boolean> {
        if (lifecycle.isInitialized()) { return true; }
        if (initPromise) { return await initPromise; }
        initPromise = (async () => {
            await composition.install();
            installed = true;
            return lifecycle.init();
        })().finally(() => { initPromise = null; });
        return await initPromise;
    }

    async function cleanup(): Promise<void> {
        if (cleanupPromise) { return await cleanupPromise; }
        cleanupPromise = (async () => {
            if (initPromise) { await Promise.allSettled([initPromise]); }
            const results: PromiseSettledResult<unknown>[] = [];
            results.push(...await Promise.allSettled([lifecycle.cleanup()]));
            if (installed) { results.push(...await Promise.allSettled([composition.dispose()])); }
            installed = false;
            const errors = results
                .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
                .map(result => result.reason as unknown);
            if (errors.length > 0) {
                throw new AggregateError(errors, 'Xiaobai OS cleanup failed');
            }
        })().finally(() => { cleanupPromise = null; });
        return await cleanupPromise;
    }

    return Object.freeze({ lifecycle, init, cleanup });
}
