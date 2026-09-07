import type { TasksSettings } from './types.js';

export function normalizeTasksSettings(value: unknown): TasksSettings {
    const autoMaintenance = value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
        && typeof (value as Record<string, unknown>).autoMaintenance === 'boolean'
        ? (value as Record<string, unknown>).autoMaintenance as boolean
        : false;
    return { autoMaintenance };
}
