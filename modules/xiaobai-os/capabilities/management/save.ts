import type { PendingCommitRecoveryResult } from '../../kernel/contracts.js';
import type { ManagementInspection, ManagementResult } from './index.js';

/** A live-run checkpoint, not a second business ledger. Owners verify their own saved state. */
export function createManagementSave(confirm: (guard: () => boolean) => Promise<PendingCommitRecoveryResult>) {
    let pending: { commit: (guard: () => boolean) => Promise<ManagementResult>; inspect: () => Promise<ManagementInspection> } | null = null;
    async function commit(guard: () => boolean) {
        if (!pending) { throw new Error('management_no_pending_operation'); }
        const result = await pending.commit(guard);
        pending = null;
        return result;
    }
    return {
        async confirmSaved() {
            if (!pending) { return null; }
            try {
                const actual = await pending.inspect();
                if (actual.status === 'confirmed') { pending = null; }
                return actual;
            } catch (error) { return { status: 'unverifiable' as const, error }; }
        },
        async run(action: (guard: () => boolean) => Promise<ManagementResult>, inspect: () => Promise<ManagementInspection>, guard: () => boolean) {
            if (pending) { throw new Error('management_pending_operation'); }
            pending = { commit: action, inspect };
            return commit(guard);
        },
        async recover(guard: () => boolean) {
            if (!pending) { return null; }
            const confirmation = await confirm(guard);
            if (!['none', 'confirmed'].includes(confirmation.status)) { throw Object.assign(new Error(`management_save_${confirmation.status}`), { uncertain: confirmation.status === 'unconfirmed' }); }
            const actual = await pending.inspect();
            if (actual.status === 'confirmed') { pending = null; return actual.result; }
            if (actual.status === 'superseded') { throw new Error('management_request_superseded'); }
            if (actual.status === 'unverifiable') { throw actual.error; }
            if (!guard()) { throw new Error('management_source_changed'); }
            return commit(guard);
        },
    };
}
