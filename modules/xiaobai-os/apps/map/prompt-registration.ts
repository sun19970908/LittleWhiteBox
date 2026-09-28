import type { PromptInjectionGroup } from '../../capabilities/prompt-injection/index.js';

export const MAP_PROMPTS = {
    id: 'map', slots: { context: { depth: 3, role: 'system' } },
} as const satisfies PromptInjectionGroup;
