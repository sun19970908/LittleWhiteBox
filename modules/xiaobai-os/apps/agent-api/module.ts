import { AGENT_CAPABILITY, type AgentCapability } from '../../capabilities/agent/index.js';
import type { AppInstallContext, XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import type { XiaobaiOsAppRuntime } from '../../types.js';
import { AGENT_API_APP_DESCRIPTOR } from './descriptor.js';
import { createAgentApiController } from './host/controller.js';

export interface AgentApiModuleDependencies {
    createRuntime?(agent: AgentCapability, execution: AppInstallContext['execution']): XiaobaiOsAppRuntime;
}

export function createAgentApiModule(
    dependencies: AgentApiModuleDependencies = {},
): XiaobaiOsAppModule {
    return {
        descriptor: AGENT_API_APP_DESCRIPTOR,
        capabilities: [AGENT_CAPABILITY],
        async install(context) {
            const agent = context.useCapability(AGENT_CAPABILITY);
            return dependencies.createRuntime?.(agent, context.execution)
                ?? createAgentApiController(agent, context.execution);
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    };
}
