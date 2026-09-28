import type { PromptInjectionGroup } from '../../capabilities/prompt-injection/index.js';

export const TASK_PROMPTS = {
    id: 'tasks', slots: { context: { depth: 2, role: 'system' } },
} as const satisfies PromptInjectionGroup;
