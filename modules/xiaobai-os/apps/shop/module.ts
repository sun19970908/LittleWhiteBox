import {
    ECONOMY_READ_CAPABILITY,
    ECONOMY_TRANSACTION_CAPABILITY,
    type EconomyReadCapability,
} from '../../capabilities/economy/index.js';
import type { AppInstallContext, XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import { PROMPT_INJECTION_CAPABILITY, type PromptInjectionCapability } from '../../capabilities/prompt-injection/index.js';
import type { PartitionStore } from '../../kernel/contracts.js';
import type { XiaobaiOsAppRuntime, XiaobaiOsChatIdentity } from '../../types.js';
import type { ShopDomainV2 } from '../../domains/shop/types.js';
import {
    createShopService,
    type ShopService,
    type ShopServiceDependencies,
} from './application/service.js';
import { SHOP_APP_DESCRIPTOR } from './descriptor.js';
import { createShopController } from './host/controller.js';
import { SHOP_PARTITION } from './partition.js';

export { SHOP_PARTITION } from './partition.js';

export interface ShopModuleInstallContext {
    ownerId: string;
    shop: ShopService;
    economy: EconomyReadCapability;
    prompts: PromptInjectionCapability;
    execution: AppInstallContext['execution'];
}

export interface ShopModuleDependencies {
    getChatIdentity: () => XiaobaiOsChatIdentity | { key?: unknown } | string | null;
    isMainGenerationActive: () => boolean;
    subscribeGeneration: (listener: () => void) => () => void;
    service?: Omit<ShopServiceDependencies, 'getCurrentChatIdentity' | 'isMainGenerationActive'>;
    createRuntime?(context: ShopModuleInstallContext): Promise<XiaobaiOsAppRuntime> | XiaobaiOsAppRuntime;
}

function identityKey(identity: ReturnType<ShopModuleDependencies['getChatIdentity']>): string {
    return typeof identity === 'string' ? identity : String(identity?.key || '');
}

export function createShopModule(dependencies: ShopModuleDependencies): XiaobaiOsAppModule {
    return {
        descriptor: SHOP_APP_DESCRIPTOR,
        partition: SHOP_PARTITION,
        capabilities: [ECONOMY_READ_CAPABILITY, ECONOMY_TRANSACTION_CAPABILITY, PROMPT_INJECTION_CAPABILITY],
        async install(context) {
            if (!context.partition) {throw new Error('Shop partition store is unavailable');}
            const economy = context.useCapability(ECONOMY_READ_CAPABILITY);
            const shop = createShopService(
                context.partition as PartitionStore<ShopDomainV2>,
                context.files,
                economy,
                {
                    ...dependencies.service,
                    getCurrentChatIdentity: () => identityKey(dependencies.getChatIdentity()),
                    isMainGenerationActive: dependencies.isMainGenerationActive,
                },
            );
            context.execution.addCleanup(shop.dispose);
            return await dependencies.createRuntime?.({
                ownerId: context.ownerId,
                shop,
                economy,
                execution: context.execution,
                prompts: context.useCapability(PROMPT_INJECTION_CAPABILITY),
            }) ?? createShopController({
                shop,
                economy,
                getChatIdentity: dependencies.getChatIdentity,
                isMainGenerationActive: dependencies.isMainGenerationActive,
                subscribeGeneration: dependencies.subscribeGeneration,
                execution: context.execution,
            });
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    };
}
