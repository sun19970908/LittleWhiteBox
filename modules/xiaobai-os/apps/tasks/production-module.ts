import type { XiaobaiOsSettingsRepository } from '../../host/settings-repository.js';
import type { MainGenerationRuntime } from '../../host/main-generation-runtime.js';
import type { XiaobaiOsChatIdentity } from '../../types.js';
import { createAppRuntimeGroup } from '../../kernel/runtime-group.js';
import { createTaskGenerationRequests } from './generation/request.js';
import { createTaskGenerationContextAdapter } from './host/context-adapter.js';
import { createTaskController } from './host/controller.js';
import { createTaskCompletionRuntime, type TaskCompletionNotice } from './host/completion-runtime.js';
import { createTaskMaintenanceParticipant } from './host/maintenance-participant.js';
import { createTaskPromptRuntime, type TaskPromptEventHandlers } from './host/prompt-runtime.js';
import { createTaskSettingsRuntime } from './host/settings-runtime.js';
import { createTasksModule } from './module.js';

export interface ProductionTasksModuleDependencies {
    settings: XiaobaiOsSettingsRepository;
    getChatIdentity: () => XiaobaiOsChatIdentity | null;
    getPlayerDisplayName: () => string;
    getObservedAssistantCount: () => number;
    mainGeneration: MainGenerationRuntime;
    setPrompt(value: string): void;
    subscribePrompt(handlers: TaskPromptEventHandlers): () => void;
    notifyCompletion(notice: TaskCompletionNotice): void;
}

export function createProductionTasksModule(dependencies: ProductionTasksModuleDependencies) {
    return createTasksModule({
        getPlayerDisplayName: dependencies.getPlayerDisplayName,
        getObservedAssistantCount: dependencies.getObservedAssistantCount,
        async install({ tasks, store, economy, agent, maintenance, mapContext, worldContext, execution }) {
            const unregisterParticipant = maintenance.registerParticipant(createTaskMaintenanceParticipant({
                tasks,
                readSettings: () => dependencies.settings.read()?.apps.tasks ?? null,
            }));
            execution.addCleanup(unregisterParticipant);
            const generation = createTaskGenerationRequests({
                gateway: agent,
                tasks,
                context: createTaskGenerationContextAdapter({
                    readMapContext: mapContext.readPromptContext,
                    readWorldContext: worldContext.readCurrent,
                }),
                isMainGenerationActive: dependencies.mainGeneration.isActive,
            });
            const controller = createTaskController({
                tasks,
                economy,
                generation,
                settings: dependencies.settings,
                maintenance: maintenance.runner,
                getChatIdentity: dependencies.getChatIdentity,
                isMainGenerationActive: dependencies.mainGeneration.isActive,
                subscribeGeneration: dependencies.mainGeneration.subscribe,
                execution,
            });
            const prompt = createTaskPromptRuntime({
                tasks,
                setPrompt: dependencies.setPrompt,
                subscribe: dependencies.subscribePrompt,
            });
            const settings = createTaskSettingsRuntime({
                settings: dependencies.settings,
                maintenance: maintenance.runner,
            });
            const completion = createTaskCompletionRuntime({ store, notify: dependencies.notifyCompletion });
            return createAppRuntimeGroup(controller, [prompt, settings, completion]);
        },
    });
}
