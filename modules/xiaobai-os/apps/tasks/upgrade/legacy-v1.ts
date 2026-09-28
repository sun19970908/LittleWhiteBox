import { validateTaskDomain } from '../../../domains/tasks/invariants.js';
import { replayTaskEvents } from '../../../domains/tasks/projection.js';
import type { TaskDomainV1, TaskEvent } from '../../../domains/tasks/types.js';

/** Production v1 shape: the obsolete count is checked, then discarded at the upgrade boundary. */
export function upgradeLegacyTasks(value: unknown): TaskDomainV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {throw new Error('tasks_upgrade_invalid_v1');}
    const old = value as Record<string, unknown>;
    if (Object.keys(old).sort().join(',') !== 'board,events,revision,schemaVersion'
        || old.schemaVersion !== 1 || !Array.isArray(old.events)) {throw new Error('tasks_upgrade_invalid_v1');}
    const events = old.events.map((raw: unknown) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {throw new Error('tasks_upgrade_invalid_event');}
        const { observedAssistantCount, ...event } = raw as Record<string, unknown>;
        if (!Number.isSafeInteger(observedAssistantCount) || Number(observedAssistantCount) < 0) {
            throw new Error('tasks_upgrade_invalid_count');
        }
        return event as unknown as TaskEvent;
    });
    const checks: TaskDomainV1['checks'] = {};
    for (const record of replayTaskEvents(events)) {
        if (record.status === 'active') {
            checks[record.taskId] = { taskRevision: record.taskRevision, phase: 'pending', digest: '' };
        }
    }
    const next: TaskDomainV1 = { schemaVersion: 2, revision: old.revision as number,
        board: old.board as TaskDomainV1['board'], storyLabel: '', events, checks };
    validateTaskDomain(next);
    return next;
}
