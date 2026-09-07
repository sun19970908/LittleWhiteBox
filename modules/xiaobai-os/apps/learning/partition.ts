import type { PartitionRegistration } from '../../kernel/contracts.js';
import { parseTeacherPreference, type LearningTeacherPreference } from '../../domains/learning/profile.js';

/** Only the teacher choice belongs to a story. Learning assets are user-owned. */
export const LEARNING_PARTITION: PartitionRegistration<LearningTeacherPreference> = Object.freeze({
    key: 'learning', ownerId: 'learning', schemaVersion: 1,
    parse(value: unknown) {
        try { return { ok: true as const, value: parseTeacherPreference(value) }; }
        catch (error) {
            return { ok: false as const, error: { code: 'partition_invalid' as const,
                message: error instanceof Error ? error.message : 'Invalid teacher preference' } };
        }
    },
    serialize: parseTeacherPreference,
    createInitial: () => ({ teacher: null }),
});
