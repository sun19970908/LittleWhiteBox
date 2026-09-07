import type { MaintenanceMode } from './registry.js';

export type MaintenanceOutcomeStatus = 'updated' | 'unchanged' | 'partial' | 'failed' | 'cancelled' | 'skipped';

export interface MaintenanceParticipantOutcome {
    readonly participantId: string;
    readonly status: MaintenanceOutcomeStatus;
    readonly changed: boolean;
    readonly reason?: string;
}

export interface MaintenanceRunOutcome {
    readonly status: MaintenanceOutcomeStatus;
    readonly mode: MaintenanceMode;
    readonly participantIds: readonly string[];
    readonly committedParticipantIds: readonly string[];
    readonly failedParticipantIds: readonly string[];
    readonly participantResults: readonly MaintenanceParticipantOutcome[];
    readonly reason?: string;
}

export function createMaintenanceOutcome(options: {
    mode: MaintenanceMode;
    status: MaintenanceOutcomeStatus;
    participantIds?: readonly string[];
    committedParticipantIds?: readonly string[];
    participantResults?: readonly MaintenanceParticipantOutcome[];
    reason?: string;
}): MaintenanceRunOutcome {
    const suppliedResults = [...(options.participantResults || [])];
    const participantIds = Object.freeze([...new Set([
        ...(options.participantIds || []),
        ...suppliedResults.map(result => result.participantId),
    ])]);
    const suppliedIds = new Set(suppliedResults.map(result => result.participantId));
    const participantResults = Object.freeze([
        ...suppliedResults,
        ...participantIds
            .filter(participantId => !suppliedIds.has(participantId))
            .map(participantId => ({
                participantId,
                status: options.status,
                changed: false,
                ...(options.reason ? { reason: options.reason } : {}),
            })),
    ]);
    return Object.freeze({
        status: options.status,
        mode: options.mode,
        participantIds,
        committedParticipantIds: Object.freeze([...(options.committedParticipantIds || [])]),
        failedParticipantIds: Object.freeze(participantResults
            .filter(result => result.status === 'failed')
            .map(result => result.participantId)),
        participantResults,
        ...(options.reason ? { reason: options.reason } : {}),
    });
}

export function aggregateMaintenanceStatus(
    results: readonly MaintenanceParticipantOutcome[],
    fallback: MaintenanceOutcomeStatus = 'unchanged',
): MaintenanceOutcomeStatus {
    if (!results.length) {return fallback;}
    const statuses = new Set(results.map(result => result.status));
    const savedChange = results.some(result => result.changed && (
        result.status === 'updated' || result.status === 'partial'
    ));
    if (statuses.has('partial') || (savedChange && (statuses.has('failed') || statuses.has('cancelled')))) {
        return 'partial';
    }
    if (statuses.has('failed')) {return 'failed';}
    if (statuses.has('cancelled')) {return 'cancelled';}
    if (statuses.has('updated')) {return 'updated';}
    if (statuses.has('unchanged')) {return 'unchanged';}
    return statuses.has('skipped') ? 'skipped' : fallback;
}
