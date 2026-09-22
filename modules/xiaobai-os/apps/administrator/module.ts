import { AGENT_CAPABILITY } from '../../capabilities/agent/index.js';
import { MANAGEMENT_CAPABILITY } from '../../capabilities/management/index.js';
import type { XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import { ADMINISTRATOR_APP_DESCRIPTOR } from './descriptor.js';
import { ADMINISTRATOR_PARTITION } from './partition.js';
import { createAdministratorRepository } from './storage/repository.js';
import type { AdministratorImages } from './storage/images.js';
import { createAdministratorConversation } from './application/conversation.js';
import { createAdministratorRuntime } from './application/runtime.js';
import { createAdministratorController } from './host/controller.js';
import type { AdministratorChatSurface } from './host/chat-reader.js';

export function createAdministratorModule(deps: { images: AdministratorImages; capture(): AdministratorChatSurface | null }): XiaobaiOsAppModule {
    let repository: ReturnType<typeof createAdministratorRepository> | null = null;
    return {
        descriptor: ADMINISTRATOR_APP_DESCRIPTOR, partition: ADMINISTRATOR_PARTITION,
        capabilities: [AGENT_CAPABILITY, MANAGEMENT_CAPABILITY],
        async install(context) {
            if (!context.partition) { throw new Error('administrator_partition_unavailable'); }
            repository = createAdministratorRepository(context.partition, context.files);
            const conversation = createAdministratorConversation(repository, deps.images);
            let controller: ReturnType<typeof createAdministratorController>;
            const runtime = createAdministratorRuntime({ conversation, repository, images: deps.images, gateway: context.useCapability(AGENT_CAPABILITY),
                management: context.useCapability(MANAGEMENT_CAPABILITY), capture: deps.capture, changed: () => controller?.emit() });
            controller = createAdministratorController(conversation, runtime);
            return controller;
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
        async clearData(context) {
            if (!repository) { throw new Error('administrator_partition_unavailable'); }
            const osId = repository.osId();
            await context.removePartition(ADMINISTRATOR_PARTITION.key);
            if (osId) { await deps.images.clear(osId); }
        },
    };
}
