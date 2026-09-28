import type { MaintenanceStatus } from '../../../capabilities/maintenance/runner.js';
import type { XiaobaiOsFileState } from '../../../kernel/contracts.js';
import type { AppFailurePhase } from '../../../kernel/execution-scope.js';
import type { XiaobaiOsAppDescriptor } from '../../../types.js';

export type AdministratorAppLoad =
    | { state: 'ready' }
    | { state: 'loading'; phase: AppFailurePhase }
    | { state: 'failed'; phase: AppFailurePhase; retryable: boolean };

export interface AdministratorFileObservation {
    state: XiaobaiOsFileState;
    hasPendingCommit: boolean;
}

export interface AdministratorEnvironment {
    observedAt: number;
    apps: (Pick<XiaobaiOsAppDescriptor, 'id' | 'name' | 'description'> & { load: AdministratorAppLoad })[];
    maintenance: {
        id: string;
        automaticEnabled: boolean;
        state: MaintenanceStatus['state'];
        mode: MaintenanceStatus['mode'];
        outcome: string | null;
        reason: string | null;
        lastProcessedAt: number | null;
    }[];
    mainChatGenerating: boolean;
    storage: { chat: AdministratorFileObservation; user: AdministratorFileObservation };
}

export type AdministratorEnvironmentReader = (chatIdentity: string) => AdministratorEnvironment;
