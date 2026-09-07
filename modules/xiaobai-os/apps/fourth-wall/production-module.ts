import type { XiaobaiOsSettingsRepository } from '../../host/settings-repository.js';
import { createFourthWallRuntime } from './host/create-runtime.js';
import { createFourthWallModule } from './module.js';
import type { FourthWallUpgradeSource } from './host/repository.js';

export function createProductionFourthWallModule(
    settings: XiaobaiOsSettingsRepository,
    upgradeSource?: FourthWallUpgradeSource,
) {
    return createFourthWallModule({
        upgradeSource,
        async install({ repository, agent }) {
            return createFourthWallRuntime(repository, settings, agent);
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    });
}
