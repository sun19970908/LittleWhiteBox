import type { AcceptedTurnSource } from '../../../capabilities/maintenance/accepted-turn-source.js';
import type { MaintenanceMode, MaintenanceParticipant } from '../../../capabilities/maintenance/registry.js';
import type { TasksService } from '../application/service.js';
import { createTaskMaintenanceSession } from '../maintenance/session.js';

export interface TaskMaintenanceSettings {
    readonly autoMaintenance: boolean;
}

interface TaskMaintenanceParticipantDependencies {
    readonly tasks: Pick<TasksService, 'readCurrent' | 'createActionId' | 'commitMaintenance'>;
    readonly readSettings: () => TaskMaintenanceSettings | null;
}

export function createTaskMaintenanceParticipant({
    tasks,
    readSettings,
}: TaskMaintenanceParticipantDependencies): MaintenanceParticipant {
    return Object.freeze({
        id: 'tasks',
        isEnabled(mode: MaintenanceMode) {
            if (mode === 'rebuild') {return false;}
            return mode === 'manual' || readSettings()?.autoMaintenance === true;
        },
        createSession(source: AcceptedTurnSource, mode: MaintenanceMode) {
            if (mode === 'rebuild') {return null;}
            const records = tasks.readCurrent().records.filter(record => (
                record.status === 'active'
                && source.assistantCount > record.lastObservedAssistantCount
            ));
            return records.length ? createTaskMaintenanceSession(tasks, source, records) : null;
        },
    });
}
