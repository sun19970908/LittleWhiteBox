import type { PromptInjectionGroup } from '../../capabilities/prompt-injection/index.js';

export const WORLD_PROMPTS = {
    id: 'world', slots: { context: { depth: 4, role: 'system' } },
} as const satisfies PromptInjectionGroup;
