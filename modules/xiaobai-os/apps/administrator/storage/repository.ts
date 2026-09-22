import type { PartitionStore, XiaobaiOsFileControls } from '../../../kernel/contracts.js';
import { createAdministratorData, parseAdministratorData } from '../domain/data.js';
import type { AdministratorData } from '../domain/types.js';
import type { AdministratorStored } from '../partition.js';

export function createAdministratorRepository(store: PartitionStore<unknown>, files: XiaobaiOsFileControls) {
    function read(): AdministratorData { const stored = store.peekCurrent()?.value as AdministratorStored | null | undefined; return stored === null || stored === undefined ? createAdministratorData() : parseAdministratorData(stored.raw); }
    return {
        read,
        async refresh() {
            const snapshot = await store.read();
            return snapshot.value === null ? createAdministratorData() : parseAdministratorData((snapshot.value as AdministratorStored).raw);
        },
        identity: () => store.peekBinding()?.identityKey ?? '',
        osId: () => store.peekBinding()?.osId ?? null,
        async save(candidate: AdministratorData, expectedRevision: number, guard: () => boolean, clear = false) {
            const result = await store.transact(transaction => {
                if (!guard()) { throw new Error('administrator_context_changed'); }
                let current = createAdministratorData();
                if (transaction.current !== null) {
                    try { current = parseAdministratorData((transaction.current as AdministratorStored).raw); }
                    catch (error) { if (!clear || (error as Error).message !== 'administrator_data_invalid') { throw error; } }
                }
                if (current.revision !== expectedRevision) { throw new Error('administrator_history_conflict'); }
                const next = parseAdministratorData({ ...candidate, revision: current.revision + 1 });
                transaction.replace({ raw: next });
                return next;
            }, { commitGuard: guard, retainFailedCandidate: true });
            if (result.status === 'failed' || result.status === 'unconfirmed' || result.status === 'conflict') {
                throw Object.assign(new Error(`administrator_save_${result.status}`), { uncertain: result.status === 'unconfirmed', saveStatus: result.status });
            }
            return result.result;
        },
        confirmPending: (readOnly = false) => files.retryPending({ readOnly }),
        adoptServer: files.adoptServerState,
        pending: () => files.hasPendingCommit(),
        writeState: files.getFileState,
        subscribe: store.subscribe,
    };
}
export type AdministratorRepository = ReturnType<typeof createAdministratorRepository>;
