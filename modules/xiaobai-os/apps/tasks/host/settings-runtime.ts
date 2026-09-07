import type { MaintenanceRunner } from '../../../capabilities/maintenance/runner.js';
import type { XiaobaiOsSettingsRepository } from '../../../host/settings-repository.js';
import type { XiaobaiOsAppRuntime } from '../../../types.js';
import type { TasksSettings } from '../types.js';

interface TaskSettingsRuntimeDependencies {
    settings: Pick<XiaobaiOsSettingsRepository, 'read' | 'subscribe' | 'subscribeMutationInstalled'>;
    maintenance: Pick<MaintenanceRunner, 'cancelRequested' | 'invalidateAutomatic'>;
}

export function createTaskSettingsRuntime({
    settings,
    maintenance,
}: TaskSettingsRuntimeDependencies): Pick<XiaobaiOsAppRuntime, 'startBackground' | 'stopBackground'> {
    let current: TasksSettings | null = null;
    let unsubscribe: (() => void) | null = null;
    let unsubscribeMutationInstalled: (() => void) | null = null;

    return Object.freeze({
        startBackground() {
            if (unsubscribe) {return;}
            current = settings.read()?.apps.tasks ?? null;
            unsubscribe = settings.subscribe(next => {current = next.apps.tasks;});
            unsubscribeMutationInstalled = settings.subscribeMutationInstalled((next) => {
                if (!next.enabled) {
                    maintenance.cancelRequested('tasks', 'os-disabled');
                    maintenance.invalidateAutomatic('tasks', 'os-disabled');
                } else if (current?.autoMaintenance && !next.apps.tasks.autoMaintenance) {
                    maintenance.invalidateAutomatic('tasks', 'automatic-disabled');
                }
            });
        },
        stopBackground() {
            unsubscribe?.();
            unsubscribeMutationInstalled?.();
            unsubscribe = null;
            unsubscribeMutationInstalled = null;
            current = null;
            maintenance.cancelRequested('tasks', 'stopped');
            maintenance.invalidateAutomatic('tasks', 'stopped');
        },
    });
}
