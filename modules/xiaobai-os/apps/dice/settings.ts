import { ACTION_CHECK_FREQUENCIES, ACTION_CHECK_RULES, type ActionCheckFrequency, type ActionCheckRule, type DiceSettings } from './types.js';

export function isActionCheckRule(value: unknown): value is ActionCheckRule {
    return ACTION_CHECK_RULES.some(rule => value === rule);
}

export function isActionCheckFrequency(value: unknown): value is ActionCheckFrequency {
    return ACTION_CHECK_FREQUENCIES.some(frequency => value === frequency);
}

export function normalizeDiceSettings(value: unknown): DiceSettings {
    const input = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    return {
        actionChecksEnabled: typeof input.actionChecksEnabled === 'boolean' ? input.actionChecksEnabled : false,
        // Upstream 32a314b8–a32c28d0 saved `light`; the standard default absorbs it at settings load.
        // Retain this conversion while those installed settings are supported; runtime writes accept only current choices.
        actionCheckFrequency: isActionCheckFrequency(input.actionCheckFrequency) ? input.actionCheckFrequency : 'standard',
        actionCheckRule: isActionCheckRule(input.actionCheckRule) ? input.actionCheckRule : 'd20',
        encountersEnabled: typeof input.encountersEnabled === 'boolean' ? input.encountersEnabled : false,
        // Preserve the user-requested sheet until the user document upgrade confirms its copy.
        // finishDiceSheetMigration removes it; ordinary settings and Dice never read this field.
        ...(Object.hasOwn(input, 'coc7Sheet') ? { coc7Sheet: input.coc7Sheet } : {}),
    };
}
