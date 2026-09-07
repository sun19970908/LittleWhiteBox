import type { XiaobaiOsAppRuntime } from '../types.js';

async function invokeAll(
    runtimes: readonly XiaobaiOsAppRuntime[],
    operation: (runtime: XiaobaiOsAppRuntime) => void | Promise<void>,
    message: string,
): Promise<void> {
    const results = await Promise.allSettled(runtimes.map(runtime => operation(runtime)));
    const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason as unknown);
    if (errors.length > 0) { throw new AggregateError(errors, message); }
}

export function createAppRuntimeGroup(
    primary: XiaobaiOsAppRuntime,
    auxiliaries: readonly XiaobaiOsAppRuntime[],
): XiaobaiOsAppRuntime {
    const runtimes = [primary, ...auxiliaries];
    const reverse = [...runtimes].reverse();
    return Object.freeze({
        activate: primary.activate?.bind(primary),
        deactivate: primary.deactivate?.bind(primary),
        handleMessage: primary.handleMessage?.bind(primary),
        cancelForeground: (reason: string) => invokeAll(
            runtimes,
            runtime => runtime.cancelForeground?.(reason),
            'APP foreground cancellation failed',
        ),
        cancelAll: (reason: string) => invokeAll(
            runtimes,
            runtime => runtime.cancelAll?.(reason),
            'APP cancellation failed',
        ),
        handleWindowOpened: () => invokeAll(
            runtimes,
            runtime => runtime.handleWindowOpened?.(),
            'APP window-open handling failed',
        ),
        handleWindowClosed: (reason: string) => invokeAll(
            reverse,
            runtime => runtime.handleWindowClosed?.(reason),
            'APP window-close handling failed',
        ),
        handleChatChanged: () => invokeAll(
            runtimes,
            runtime => runtime.handleChatChanged?.(),
            'APP chat-change handling failed',
        ),
        startBackground: () => invokeAll(
            runtimes,
            runtime => runtime.startBackground?.(),
            'APP background start failed',
        ),
        stopBackground: () => invokeAll(
            reverse,
            runtime => runtime.stopBackground?.(),
            'APP background stop failed',
        ),
    });
}
