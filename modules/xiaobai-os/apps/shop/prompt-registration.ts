import type { PromptInjectionGroup } from '../../capabilities/prompt-injection/index.js';

export const SHOP_PROMPTS = {
    id: 'shop', slots: { effects: { depth: 1, role: 'system' } },
} as const satisfies PromptInjectionGroup;
