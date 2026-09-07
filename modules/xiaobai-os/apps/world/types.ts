import type { WorldDomainV1 } from '../../domains/world/types.js';
import type { XiaobaiOsFileState } from '../../kernel/contracts.js';

export interface WorldClientState {
    chatIdentity: string;
    world: WorldDomainV1;
    writeState: XiaobaiOsFileState;
    pendingSave: boolean;
    maintenance: 'idle' | 'running' | 'error';
    message: string;
}
