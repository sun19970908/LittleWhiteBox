import {
    ECONOMY_READ_CAPABILITY,
    ECONOMY_TRANSACTION_CAPABILITY,
    type EconomyReadCapability,
} from '../../capabilities/economy/index.js';
import type { AppInstallContext, XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import type { ScopedChatStore } from '../../kernel/contracts.js';
import type { XiaobaiOsAppRuntime } from '../../types.js';
import type { BankDomainV1 } from '../../domains/bank/types.js';
import {
    createBankService,
    type BankService,
    type BankServiceDependencies,
} from './application/service.js';
import { BANK_APP_DESCRIPTOR } from './descriptor.js';
import { BANK_PARTITION } from './partition.js';

export { BANK_PARTITION } from './partition.js';

export interface BankModuleInstallContext {
    ownerId: string;
    bank: BankService;
    economy: EconomyReadCapability;
    execution: AppInstallContext['execution'];
}

export interface BankModuleDependencies {
    service?: BankServiceDependencies;
    install(context: BankModuleInstallContext): Promise<XiaobaiOsAppRuntime>;
    dispose?(runtime: XiaobaiOsAppRuntime): Promise<void>;
}

export function createBankModule(dependencies: BankModuleDependencies): XiaobaiOsAppModule {
    return {
        descriptor: BANK_APP_DESCRIPTOR,
        partition: BANK_PARTITION,
        capabilities: [ECONOMY_READ_CAPABILITY, ECONOMY_TRANSACTION_CAPABILITY],
        install(context) {
            if (!context.partition) { throw new Error('Bank partition store is unavailable'); }
            const economy = context.useCapability(ECONOMY_READ_CAPABILITY);
            const bank = createBankService(
                context.partition as ScopedChatStore<BankDomainV1>,
                context.files,
                economy,
                dependencies.service,
            );
            context.execution.addCleanup(bank.dispose);
            return dependencies.install({
                ownerId: context.ownerId,
                bank,
                economy,
                execution: context.execution,
            });
        },
        dispose: dependencies.dispose,
        clearData: context => context.removePartition(BANK_PARTITION.key),
    };
}
