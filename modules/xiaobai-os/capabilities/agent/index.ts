import {
    createCapabilityToken,
    type CapabilityRegistration,
} from '../../kernel/capability-registry.js';
import type { CapabilityToken } from '../../kernel/contracts.js';
import type { XiaobaiOsAgentGateway } from './gateway.js';

export type AgentCapability = XiaobaiOsAgentGateway;

export const AGENT_CAPABILITY: CapabilityToken<AgentCapability> = createCapabilityToken('agent.shared');

export function createAgentCapabilityRegistration(): CapabilityRegistration<AgentCapability> {
    return {
        token: AGENT_CAPABILITY,
        ownerId: 'agent',
        dependencies: [],
        install: async () => (await import('./gateway.js')).createXiaobaiOsAgentGateway(),
    };
}

export type {
    XiaobaiOsAgentRunRequest,
    XiaobaiOsAgentSession,
} from './gateway.js';
