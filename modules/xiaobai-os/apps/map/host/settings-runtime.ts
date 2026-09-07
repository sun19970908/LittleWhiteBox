import type { MaintenanceRunner } from '../../../capabilities/maintenance/runner.js';
import type { XiaobaiOsSettingsRepository } from '../../../host/settings-repository.js';
import type { XiaobaiOsAppRuntime } from '../../../types.js';
import type { MapSettings } from '../types.js';

interface MapSettingsRuntimeDependencies {
    settings: Pick<XiaobaiOsSettingsRepository, 'read' | 'subscribe' | 'subscribeMutationInstalled'>;
    maintenance: Pick<MaintenanceRunner, 'cancelRequested' | 'invalidateAutomatic'>;
}

export function createMapSettingsRuntime({
    settings,
    maintenance,
}: MapSettingsRuntimeDependencies): Pick<XiaobaiOsAppRuntime, 'startBackground' | 'stopBackground'> {
    let current: MapSettings | null = null;
    let unsubscribe: (() => void) | null = null;
    let unsubscribeMutationInstalled: (() => void) | null = null;

    function fenceInstalledMutation(
        next: NonNullable<ReturnType<XiaobaiOsSettingsRepository['read']>>,
    ): void {
        if (!next.enabled) {
            maintenance.cancelRequested('map', 'os-disabled');
            maintenance.invalidateAutomatic('map', 'os-disabled');
        } else if (current?.autoMaintenance && !next.apps.map.autoMaintenance) {
            maintenance.invalidateAutomatic('map', 'automatic-disabled');
        }
    }

    return Object.freeze({
        startBackground() {
            if (unsubscribe) {return;}
            current = settings.read()?.apps.map || null;
            unsubscribe = settings.subscribe(next => {current = next.apps.map;});
            unsubscribeMutationInstalled = settings.subscribeMutationInstalled(fenceInstalledMutation);
        },
        stopBackground() {
            unsubscribe?.();
            unsubscribeMutationInstalled?.();
            unsubscribe = null;
            unsubscribeMutationInstalled = null;
            current = null;
            maintenance.cancelRequested('map', 'stopped');
            maintenance.invalidateAutomatic('map', 'stopped');
        },
    });
}
