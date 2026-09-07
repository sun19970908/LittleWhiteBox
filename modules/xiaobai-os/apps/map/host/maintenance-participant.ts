import type { MapService } from '../application/service.js';
import type { MapSettings } from '../types.js';
import type { MaintenanceMode, MaintenanceParticipant } from '../../../capabilities/maintenance/registry.js';
import type { AcceptedTurnSource } from '../../../capabilities/maintenance/accepted-turn-source.js';
import { createMapMaintenanceSession } from '../maintenance/session.js';

export { MAP_MAINTENANCE_TOOL_NAMES } from '../maintenance/tool-contract.js';

export interface MapMaintenanceParticipantDependencies {
    readonly map: MapService;
    readonly readSettings: () => MapSettings | null;
}

export function createMapMaintenanceParticipant({
    map,
    readSettings,
}: MapMaintenanceParticipantDependencies): MaintenanceParticipant {
    return Object.freeze({
        id: 'map',
        isEnabled(mode: MaintenanceMode) {
            const settings = readSettings();
            return mode !== 'automatic' || settings?.autoMaintenance === true;
        },
        async createSession(source: AcceptedTurnSource, mode: MaintenanceMode) {
            await map.refreshCurrent();
            return createMapMaintenanceSession(map, source, mode);
        },
    });
}
