import {
    ECONOMY_READ_CAPABILITY,
    type EconomyReadCapability,
} from '../../capabilities/economy/index.js';
import type { AppInstallContext, XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import type { XiaobaiOsAppRuntime, XiaobaiOsChatIdentity } from '../../types.js';
import { WALLET_APP_DESCRIPTOR } from './descriptor.js';
import { createWalletController } from './host/controller.js';

export interface WalletModuleDependencies {
    getChatIdentity: () => XiaobaiOsChatIdentity | { key?: unknown } | string | null;
    createRuntime?(
        economy: EconomyReadCapability,
        execution: AppInstallContext['execution'],
    ): XiaobaiOsAppRuntime;
}

export function createWalletModule(dependencies: WalletModuleDependencies): XiaobaiOsAppModule {
    return {
        descriptor: WALLET_APP_DESCRIPTOR,
        capabilities: [ECONOMY_READ_CAPABILITY],
        async install(context) {
            const economy = context.useCapability(ECONOMY_READ_CAPABILITY);
            return dependencies.createRuntime?.(economy, context.execution)
                ?? createWalletController({
                    economy,
                    confirmPending: context.files.retryPending,
                    getChatIdentity: dependencies.getChatIdentity,
                    execution: context.execution,
                });
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    };
}
