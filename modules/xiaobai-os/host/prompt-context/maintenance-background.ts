import type { MaintenanceJobExecutorHooks } from '../../capabilities/maintenance/job-executor.js';
import type { WorldContextCapability } from '../../apps/world/context-capability.js';
import { buildWorldDataMessage } from '../../apps/world/prompt-data.js';
import { buildPromptCurrentStateBlock, buildPromptSettingBlock } from './format.js';
import type { PromptContextAdapter } from './types.js';

export function createMaintenanceBackgroundCapture({ promptContext, readMapContext, readWorldContext }: {
    promptContext: PromptContextAdapter;
    readMapContext(): string;
    readWorldContext: WorldContextCapability['readCurrent'];
}): MaintenanceJobExecutorHooks['captureBackground'] {
    return async (source, mode, participantIds) => {
        const firstAcceptedIndex = source.messages[0]?.index ?? source.trigger?.index ?? 0;
        const acceptedThroughIndex = source.messages.at(-1)?.index ?? firstAcceptedIndex;
        const captured = await promptContext.capture({
            throughMessageIndex: acceptedThroughIndex,
            recentBeforeIndex: firstAcceptedIndex,
        });
        if (captured.chatIdentity !== source.chatIdentity) { throw new Error('maintenance_chat_changed'); }
        const mapContext = mode === 'rebuild' ? '' : readMapContext();
        // An active World session already supplies its budgeted initial publication.
        const world = participantIds.includes('world') ? null : readWorldContext(source.chatIdentity);
        const setting = buildPromptSettingBlock(captured.contextSnapshot);
        const currentState = buildPromptCurrentStateBlock(captured.contextSnapshot, {
            additionalSections: [mapContext, ...(world ? [buildWorldDataMessage(world)] : [])],
        });
        return [
            { role: 'system' as const, content: setting },
            ...(currentState ? [{ role: 'system' as const, content: currentState }] : []),
        ];
    };
}
