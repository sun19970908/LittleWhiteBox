import { normalizeAgentSettings } from '../../../agent-core/config.js';
import { isSillyTavernProvider, resolveActiveProviderConfig } from '../../../agent-core/provider-resolution.js';
import { createAppRuntimeGroup } from '../../kernel/runtime-group.js';
import { createWorldModule } from './module.js';
import { createWorldController } from './host/controller.js';
import { createWorldMaintenanceParticipant } from './host/maintenance-participant.js';
import { createWorldPromptRuntime, type WorldPromptEventHandlers } from './host/prompt-runtime.js';

export function createProductionWorldModule(dependencies: {
    getChatIdentity(): string;
    setPrompt(value: string): void;
    subscribePrompt(handlers: WorldPromptEventHandlers): () => void;
}) {
    return createWorldModule({
        getChatIdentity: dependencies.getChatIdentity,
        install({ world, maintenance, agent, execution }) {
            const unregister = maintenance.registerParticipant(createWorldMaintenanceParticipant(world));
            execution.addCleanup(unregister);
            const controller = createWorldController({ world, maintenance: maintenance.runner,
                getChatIdentity: dependencies.getChatIdentity,
                async checkAgent() {
                    const config = resolveActiveProviderConfig(normalizeAgentSettings(await agent.loadConfig()));
                    return !!String(config.model || '').trim()
                        && (isSillyTavernProvider(config.provider) || !!String(config.apiKey || '').trim());
                },
            });
            const prompt = createWorldPromptRuntime({ world, getChatIdentity: dependencies.getChatIdentity,
                setPrompt: dependencies.setPrompt, subscribe: dependencies.subscribePrompt });
            return createAppRuntimeGroup(controller, [prompt]);
        },
    });
}
