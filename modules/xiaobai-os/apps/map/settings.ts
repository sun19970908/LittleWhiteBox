import type { MapSettings } from './types.js';

export function normalizeMapSettings(value: unknown): MapSettings {
    const autoMaintenance = value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
        && typeof (value as Record<string, unknown>).autoMaintenance === 'boolean'
        ? (value as Record<string, unknown>).autoMaintenance as boolean
        : false;
    return { autoMaintenance };
}
