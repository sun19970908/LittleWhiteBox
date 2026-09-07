import { getStorySummaryCharacters } from '../../../story-summary/story-summary.js';
import type { KnownPerson } from '../../host/prompt-context/known-people.js';
import type { PromptContextAdapter } from '../../host/prompt-context/types.js';
import { getSillyTavernChatIdentity, getSillyTavernChatSurface } from '../../host/sillytavern-context.js';
import type { LearningRepository } from './application/service.js';
import { createLearningContextAdapter } from './host/context-adapter.js';
import { createLearningModule } from './module.js';

export function createProductionLearningModule(repository: LearningRepository, promptContext: PromptContextAdapter) {
    const people = (name = '') => getStorySummaryCharacters({ name,
        throughMessageIndex: (getSillyTavernChatSurface()?.messages.length ?? 0) - 1,
        maxCharacters: name ? 8000 : 12000, maxPeople: 200 }) as KnownPerson[];
    const context = createLearningContextAdapter(promptContext, people);
    return createLearningModule({ repository, people, capture: context.capture,
        chatIdentity: () => getSillyTavernChatIdentity()?.key ?? '',
        playerName: () => getSillyTavernChatSurface()?.playerName ?? '',
    });
}
