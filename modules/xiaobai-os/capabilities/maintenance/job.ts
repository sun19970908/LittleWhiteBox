import type { AcceptedTurnSource } from './accepted-turn-source.js';
import {
    aggregateMaintenanceStatus,
    createMaintenanceOutcome,
    type MaintenanceParticipantOutcome,
    type MaintenanceRunOutcome,
} from './outcome.js';
import type { MaintenanceDataMessage, MaintenanceMode, MaintenanceParticipant, MaintenanceSession } from './registry.js';

export interface MaintenanceSessionRun {
    readonly participant: MaintenanceParticipant;
    readonly session: MaintenanceSession;
    readonly automaticToken: number;
    invalid: boolean;
}

export interface MaintenanceQueuedJob {
    readonly mode: MaintenanceMode;
    readonly source: AcceptedTurnSource;
    readonly participantId: string | null;
    readonly epoch: number;
    readonly manualToken: number;
    readonly excludedParticipantIds: Set<string>;
    controller: AbortController;
    sessions: MaintenanceSessionRun[];
    earlyResults: MaintenanceParticipantOutcome[];
    backgroundMessages: MaintenanceDataMessage[];
    cancelledReason: string;
    committing: boolean;
    settled: boolean;
    resolve?: (outcome: MaintenanceRunOutcome) => void;
}

export function jobParticipantIds(job: MaintenanceQueuedJob): string[] {
    return [...new Set([
        ...(job.participantId ? [job.participantId] : []),
        ...job.sessions.map(run => run.participant.id),
        ...job.earlyResults.map(result => result.participantId),
    ])];
}

export function cancelledJobOutcome(job: MaintenanceQueuedJob, reason: string): MaintenanceRunOutcome {
    const ids = jobParticipantIds(job);
    const existing = new Map(job.earlyResults.map(result => [result.participantId, result]));
    return createMaintenanceOutcome({
        mode: job.mode,
        status: 'cancelled',
        participantIds: ids,
        participantResults: ids.map(participantId => existing.get(participantId) || ({
            participantId,
            status: 'cancelled',
            changed: false,
            reason,
        })),
        reason,
    });
}

export function failedJobOutcome(
    job: MaintenanceQueuedJob,
    ids: readonly string[],
    reason: string,
): MaintenanceRunOutcome {
    const allIds = [...new Set([...jobParticipantIds(job), ...ids])];
    const existing = new Map(job.earlyResults.map(result => [result.participantId, result]));
    const participantResults = allIds.map(participantId => existing.get(participantId) || ({
        participantId,
        status: 'failed' as const,
        changed: false,
        reason,
    }));
    return createMaintenanceOutcome({
        mode: job.mode,
        status: aggregateMaintenanceStatus(participantResults, 'failed'),
        participantIds: allIds,
        participantResults,
        reason,
    });
}
