import type { AcceptedTurnSource } from './accepted-turn-source.js';

type UnknownRecord = Record<string, unknown>;

export type MaintenanceMode = 'automatic' | 'manual' | 'rebuild';

export interface MaintenanceFunctionDeclaration {
    readonly type: 'function';
    readonly function: {
        readonly name: string;
        readonly description?: string;
        readonly parameters: UnknownRecord;
    };
}

export type MaintenanceCommitGuard = () => boolean;

export interface MaintenanceParticipantResult {
    readonly status: 'updated' | 'unchanged' | 'partial' | 'failed';
    readonly changed: boolean;
}

export interface MaintenanceDataMessage {
    readonly role: 'system' | 'user';
    readonly content: string;
}

export interface MaintenanceSession {
    readonly participantId: string;
    readonly prompt: string;
    readonly dataMessages: readonly MaintenanceDataMessage[];
    readonly tools: readonly MaintenanceFunctionDeclaration[];
    /** Defaults to preserving valid staging; complete-run requires a finished loop without unresolved tool failures for this domain. */
    readonly commitPolicy?: 'staged' | 'complete-run';
    executeTool: (name: string, args: unknown) => unknown | Promise<unknown>;
    canCommit: () => boolean | Promise<boolean>;
    /** Reports domain-owned semantic tool failures as well as staged changes. */
    getResult: () => MaintenanceParticipantResult;
    commit: (beforeCommit: MaintenanceCommitGuard) => unknown | Promise<unknown>;
    invalidate?: (reason: string) => void;
}

export interface MaintenanceParticipant {
    readonly id: string;
    isEnabled: (mode: MaintenanceMode) => boolean;
    createSession: (
        source: AcceptedTurnSource,
        mode: MaintenanceMode,
    ) => MaintenanceSession | null | Promise<MaintenanceSession | null>;
}

export interface MaintenanceRegistry {
    readonly participants: readonly MaintenanceParticipant[];
    register(participant: MaintenanceParticipant): () => void;
    getById: (participantId: string) => MaintenanceParticipant | undefined;
    selectByMode: (mode: MaintenanceMode) => readonly MaintenanceParticipant[];
    selectById: (participantId: string, mode: MaintenanceMode) => MaintenanceParticipant | undefined;
}

export function createMaintenanceRegistry(
    participants: readonly MaintenanceParticipant[] = [],
): MaintenanceRegistry {
    if (!Array.isArray(participants)) {throw new TypeError('Maintenance participants must be an array.');}

    const byId = new Map<string, MaintenanceParticipant>();

    function register(participant: MaintenanceParticipant): () => void {
        const id = String(participant?.id || '').trim();
        if (!id) {throw new TypeError('Maintenance participant id is required.');}
        if (byId.has(id)) {throw new TypeError(`Duplicate maintenance participant id: ${id}`);}
        if (typeof participant.isEnabled !== 'function' || typeof participant.createSession !== 'function') {
            throw new TypeError(`Invalid maintenance participant: ${id}`);
        }
        byId.set(id, participant);
        return () => {
            if (byId.get(id) === participant) { byId.delete(id); }
        };
    }

    for (const participant of participants) { register(participant); }

    return Object.freeze({
        get participants() { return Object.freeze([...byId.values()]); },
        register,
        getById(participantId: string) {
            return byId.get(String(participantId || '').trim());
        },
        selectByMode(mode: MaintenanceMode) {
            return Object.freeze([...byId.values()].filter(participant => participant.isEnabled(mode)));
        },
        selectById(participantId: string, mode: MaintenanceMode) {
            const participant = byId.get(String(participantId || '').trim());
            return participant?.isEnabled(mode) ? participant : undefined;
        },
    });
}
