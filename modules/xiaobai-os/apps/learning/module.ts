import { AGENT_CAPABILITY } from '../../capabilities/agent/index.js';
import { ECONOMY_READ_CAPABILITY, ECONOMY_TRANSACTION_CAPABILITY } from '../../capabilities/economy/index.js';
import type { LearningTeacherPreference } from '../../domains/learning/profile.js';
import type { XiaobaiOsAppModule } from '../../kernel/app-registry.js';
import type { PartitionStore } from '../../kernel/contracts.js';
import { LEARNING_APP_DESCRIPTOR } from './descriptor.js';
import { createLearningRuntime } from './host/runtime.js';
import { LEARNING_PARTITION } from './partition.js';
import { LEARNING_REWARDS_PARTITION } from './reward-partition.js';

export function createLearningModule(deps: Omit<Parameters<typeof createLearningRuntime>[0], 'store' | 'files' | 'rewardStore' | 'rewardFiles' | 'agent' | 'economy' | 'execution'>): XiaobaiOsAppModule {
    return {
        descriptor: LEARNING_APP_DESCRIPTOR, partition: LEARNING_PARTITION,
        additionalPartitions: [LEARNING_REWARDS_PARTITION],
        capabilities: [AGENT_CAPABILITY, ECONOMY_READ_CAPABILITY, ECONOMY_TRANSACTION_CAPABILITY],
        async install(context) {
            if (!context.partition) { throw new Error('Learning partition unavailable'); }
            const rewardStore = context.storeFor(LEARNING_REWARDS_PARTITION);
            await rewardStore.read();
            return createLearningRuntime({ ...deps, store: context.partition as PartitionStore<LearningTeacherPreference>,
                rewardStore, rewardFiles: context.filesFor(LEARNING_REWARDS_PARTITION),
                files: context.files, execution: context.execution,
                agent: context.useCapability(AGENT_CAPABILITY), economy: context.useCapability(ECONOMY_READ_CAPABILITY) });
        },
        // OS chat cleanup owns only the preference; user-level assets have explicit in-app deletion.
        clearData: context => context.removePartition(LEARNING_PARTITION.key),
    };
}
