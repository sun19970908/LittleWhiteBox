import {
    createCapabilityToken,
    type CapabilityRegistration,
} from '../../kernel/capability-registry.js';
import type { CapabilityToken } from '../../kernel/contracts.js';
import { AGENT_CAPABILITY, type AgentCapability } from '../agent/index.js';
import { createMaintenanceRegistry, type MaintenanceParticipant, type MaintenanceRegistry } from './registry.js';
import {
    createMaintenanceRunner,
    type MaintenanceRunner,
    type MaintenanceRunnerDependencies,
} from './runner.js';

export interface MaintenanceCapability {
    readonly agent: AgentCapability;
    readonly registry: MaintenanceRegistry;
    readonly runner: MaintenanceRunner;
    registerParticipant(participant: MaintenanceParticipant): () => void;
}

export const MAINTENANCE_CAPABILITY: CapabilityToken<MaintenanceCapability> =
    createCapabilityToken('maintenance.runner');

export function createMaintenanceCapabilityRegistration(
    dependencies: Omit<MaintenanceRunnerDependencies, 'registry' | 'gateway'>,
    participants: readonly MaintenanceParticipant[] = [],
): CapabilityRegistration<MaintenanceCapability> {
    let installedRunner: MaintenanceRunner | null = null;
    return {
        token: MAINTENANCE_CAPABILITY,
        ownerId: 'maintenance',
        dependencies: [AGENT_CAPABILITY],
        install: context => {
            const agent = context.require(AGENT_CAPABILITY);
            const registry = createMaintenanceRegistry(participants);
            const runner = createMaintenanceRunner({ ...dependencies, registry, gateway: agent });
            installedRunner = runner;
            return Object.freeze({
                agent,
                registry,
                runner,
                registerParticipant: (participant: MaintenanceParticipant) => registry.register(participant),
            });
        },
        dispose: () => {
            installedRunner?.stopBackground();
            installedRunner = null;
        },
    };
}

export * from './accepted-turn-source.js';
export * from './fifo-coordinator.js';
export * from './registry.js';
export * from './runner.js';
