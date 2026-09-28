import type { PromptContextLimitOverrides } from '../../../host/prompt-context/normalize.js';

/** Messages preserves source material; its request budget rejects uncompressible overflow. */
export const MESSAGE_CONTEXT_LIMITS: PromptContextLimitOverrides = {
    characters: Number.MAX_SAFE_INTEGER,
    recentMessages: 12,
    messageText: Number.MAX_SAFE_INTEGER,
    persona: Number.MAX_SAFE_INTEGER,
    characterDescription: Number.MAX_SAFE_INTEGER,
    characterPersonality: Number.MAX_SAFE_INTEGER,
    characterScenario: Number.MAX_SAFE_INTEGER,
    characterNote: Number.MAX_SAFE_INTEGER,
    exampleDialogue: Number.MAX_SAFE_INTEGER,
    worldBefore: Number.MAX_SAFE_INTEGER,
    worldAfter: Number.MAX_SAFE_INTEGER,
    worldDepthEntry: Number.MAX_SAFE_INTEGER,
    worldDepthTotal: Number.MAX_SAFE_INTEGER,
};
