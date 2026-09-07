import type { XiaobaiOsChatIdentity } from '../../types.js';
import type { MainGenerationRuntime } from '../../host/main-generation-runtime.js';
import { createBankController } from './host/controller.js';
import { createBankModule } from './module.js';

export interface ProductionBankModuleDependencies {
    getChatIdentity: () => XiaobaiOsChatIdentity | null;
    getCurrentAssistantTurn: () => number;
    mainGeneration: MainGenerationRuntime;
}

export function createProductionBankModule(dependencies: ProductionBankModuleDependencies) {
    return createBankModule({
        service: {
            getCurrentAssistantTurn: dependencies.getCurrentAssistantTurn,
            isMainGenerationActive: dependencies.mainGeneration.isActive,
        },
        async install({ bank, economy, execution }) {
            return createBankController({
                bank,
                economy,
                getChatIdentity: dependencies.getChatIdentity,
                isMainGenerationActive: dependencies.mainGeneration.isActive,
                subscribeGeneration: dependencies.mainGeneration.subscribe,
                execution,
            });
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    });
}
