import type { MaintenanceStatus } from '../../../capabilities/maintenance/runner.js';
import type { XiaobaiOsFileControls } from '../../../kernel/contracts.js';
import type { AppStatus } from '../../../kernel/execution-scope.js';
import type { XiaobaiOsAppDescriptor } from '../../../types.js';
import type { AdministratorAppLoad, AdministratorEnvironmentReader, AdministratorFileObservation } from '../domain/environment.js';

type FileReader = Pick<XiaobaiOsFileControls, 'getFileState' | 'hasPendingCommit'>;
export interface AdministratorEnvironmentSources {
    captureIdentity(): string | null;
    descriptors(): readonly XiaobaiOsAppDescriptor[];
    appStatus(id: string): AppStatus;
    maintenance(chatIdentity: string): readonly { id: string; automaticEnabled: boolean; status: MaintenanceStatus }[];
    mainChatGenerating(): boolean;
    chatFile: FileReader;
    userFile: FileReader;
}

function projectLoad(status: AppStatus): AdministratorAppLoad {
    switch (status.state) {
        case 'ready': return { state: status.state };
        case 'loading': return { state: status.state, phase: status.phase };
        case 'failed': return { state: status.state, phase: status.failure.phase, retryable: status.failure.retryable };
    }
}

function projectFile(source: FileReader): AdministratorFileObservation {
    return { state: source.getFileState(), hasPendingCommit: source.hasPendingCommit() };
}

/** Synchronous observation only: no loading, recovery, probing or background work. */
export function createAdministratorEnvironmentReader(source: AdministratorEnvironmentSources): AdministratorEnvironmentReader {
    return chatIdentity => {
        const assertIdentity = () => {
            if (source.captureIdentity() !== chatIdentity) { throw new Error('administrator_context_changed'); }
        };
        assertIdentity();
        try {
            return {
                observedAt: Date.now(),
                apps: source.descriptors().map(({ id, name, description }) => ({ id, name, description, load: projectLoad(source.appStatus(id)) })),
                maintenance: source.maintenance(chatIdentity).map(({ id, automaticEnabled, status }) => ({
                    id, automaticEnabled, state: status.state, mode: status.mode,
                    outcome: status.message || null, reason: status.reason || null, lastProcessedAt: status.lastRunAt,
                })),
                mainChatGenerating: source.mainChatGenerating(),
                storage: { chat: projectFile(source.chatFile), user: projectFile(source.userFile) },
            };
        } finally { assertIdentity(); }
    };
}
