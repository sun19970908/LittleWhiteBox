import {
    ECONOMY_READ_CAPABILITY,
    ECONOMY_TRANSACTION_CAPABILITY,
    type EconomyReadCapability,
} from '../../capabilities/economy/index.js';
import type { AppInstallContext, XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import type { ScopedChatStore } from '../../kernel/contracts.js';
import type { GameDomainV1 } from '../../domains/game/types.js';
import type { XiaobaiOsAppRuntime } from '../../types.js';
import {
    createGameService,
    type GameService,
    type GameServiceDependencies,
} from './application/service.js';
import { GAME_APP_DESCRIPTOR } from './descriptor.js';
import { GAME_PARTITION } from './partition.js';

export { GAME_PARTITION } from './partition.js';

export interface GameModuleInstallContext {
    ownerId: string;
    game: GameService;
    economy: EconomyReadCapability;
    execution: AppInstallContext['execution'];
}

export interface GameModuleDependencies {
    install(context: GameModuleInstallContext): Promise<XiaobaiOsAppRuntime>;
    dispose?(runtime: XiaobaiOsAppRuntime): Promise<void>;
    service?: GameServiceDependencies;
}

export function createGameModule(dependencies: GameModuleDependencies): XiaobaiOsAppModule {
    return {
        descriptor: GAME_APP_DESCRIPTOR,
        partition: GAME_PARTITION,
        capabilities: [ECONOMY_READ_CAPABILITY, ECONOMY_TRANSACTION_CAPABILITY],
        install(context) {
            if (!context.partition) {throw new Error('Game partition store is unavailable');}
            const economy = context.useCapability(ECONOMY_READ_CAPABILITY);
            const game = createGameService(
                context.partition as ScopedChatStore<GameDomainV1>,
                context.files,
                economy,
                dependencies.service,
            );
            context.execution.addCleanup(game.dispose);
            return dependencies.install({
                ownerId: context.ownerId,
                game,
                economy,
                execution: context.execution,
            });
        },
        dispose: dependencies.dispose,
        clearData: context => context.removePartition(GAME_PARTITION.key),
    };
}
