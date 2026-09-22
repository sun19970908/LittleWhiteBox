import type { XiaobaiOsSettingsRepository } from '../../host/settings-repository.js';
import type { XiaobaiOsChatIdentity } from '../../types.js';
import { createAppRuntimeGroup } from '../../kernel/runtime-group.js';
import { createMapController } from './host/controller.js';
import { createMapMaintenanceParticipant } from './host/maintenance-participant.js';
import { createMapPromptRuntime, type MapPromptEventHandlers } from './host/prompt-runtime.js';
import { createMapSettingsRuntime } from './host/settings-runtime.js';
import { createMapModule } from './module.js';
import { createMapManagement } from './management/participant.js';

export interface ProductionMapModuleDependencies {
    settings: XiaobaiOsSettingsRepository;
    getChatIdentity: () => XiaobaiOsChatIdentity | null;
    getPlayerDisplayName: () => string;
    setPrompt(value: string): void;
    subscribePrompt(handlers: MapPromptEventHandlers): () => void;
}

export function createProductionMapModule(dependencies: ProductionMapModuleDependencies) {
    return createMapModule({
        async install({ map, maintenance, management, execution }) {
            execution.addCleanup(management.register(createMapManagement(map, () => ({ actorKey: 'player', displayName: dependencies.getPlayerDisplayName() }))));
            const unregisterParticipant = maintenance.registerParticipant(createMapMaintenanceParticipant({
                map,
                readSettings: () => dependencies.settings.read()?.apps.map ?? null,
            }));
            execution.addCleanup(unregisterParticipant);
            const controller = createMapController({
                map,
                settings: dependencies.settings,
                maintenance: maintenance.runner,
                getChatIdentity: dependencies.getChatIdentity,
                subscribeData: map.subscribe,
            });
            const prompt = createMapPromptRuntime({
                readCurrentMap: () => map.readCurrent().map,
                setPrompt: dependencies.setPrompt,
                subscribe: dependencies.subscribePrompt,
            });
            const settings = createMapSettingsRuntime({
                settings: dependencies.settings,
                maintenance: maintenance.runner,
            });
            return createAppRuntimeGroup(controller, [prompt, settings]);
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    });
}
