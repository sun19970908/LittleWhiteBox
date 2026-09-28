import type { BankActivityView } from '../types.js';

/** Migrated IDs are only unique within their original story. */
export function bankActivityKey(activity: Pick<BankActivityView, 'id' | 'sourceStoryId'>): string {
    return JSON.stringify([activity.sourceStoryId ? 'legacy' : 'current', activity.sourceStoryId ?? null, activity.id]);
}
