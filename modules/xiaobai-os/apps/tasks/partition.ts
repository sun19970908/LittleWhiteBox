import type { PartitionRegistration } from '../../kernel/contracts.js';
import { createEmptyTaskDomain, parseTaskDomain } from '../../domains/tasks/invariants.js';
import type { TaskDomainV1 } from '../../domains/tasks/types.js';
import { TASKS_APP_DESCRIPTOR } from './descriptor.js';

export const TASKS_PARTITION: PartitionRegistration<TaskDomainV1> = Object.freeze({
    key: 'tasks',
    ownerId: TASKS_APP_DESCRIPTOR.id,
    schemaVersion: 1,
    parse(value: unknown) {
        try { return { ok: true as const, value: parseTaskDomain(value) }; }
        catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Tasks partition is invalid',
                },
            };
        }
    },
    serialize: parseTaskDomain,
    createInitial: createEmptyTaskDomain,
});
