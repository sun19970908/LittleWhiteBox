import { ECONOMY_TRANSACTION_CAPABILITY } from '../../../capabilities/economy/index.js';
import type { PartitionStore, XiaobaiOsFileControls } from '../../../kernel/contracts.js';
import { parseCoc7Sheet, type Coc7Sheet } from '../domain/coc7-sheet.js';
import type { DiceData } from '../partition.js';
import { COC7_RESET_COST } from '../domain/coc7-reset.js';
import { COC7_SHEET_COPY as copy } from './sheet-copy.js';
import { createStorageId } from '../../../kernel/identity.js';

/** The reset and its payment are one candidate; confirmation never executes the reset again. */
export function createDiceSheetService(store: PartitionStore<DiceData>, files: XiaobaiOsFileControls) {
    return {
        read: () => store.peekCurrent()?.value?.sheet ?? null,
        refresh: () => store.read(),
        subscribe(listener: () => void) {
            const unsubscribeStore = store.subscribe(listener);
            const unsubscribeFile = files.subscribeFileState(listener);
            return () => { unsubscribeStore(); unsubscribeFile(); };
        },
        getFileState: files.getFileState,
        async confirm() {
            const result = await files.retryPending();
            if (result.error?.code === 'commit_guard_rejected') { throw new Error(copy.operationExpired); }
            if (!['confirmed', 'none'].includes(result.status)) { throw new Error(copy.saveUnconfirmed); }
        },
        async save(sheet: Coc7Sheet | null, guard: () => boolean) {
            const validated = sheet === null ? null : parseCoc7Sheet(sheet);
            const result = await store.transact(transaction => {
                const current = transaction.currentOrInitial();
                if (validated === null) {
                    if (current.sheet === null) { return; }
                    const economy = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
                    if (economy.getPlayerBalance() < COC7_RESET_COST) { throw new Error(copy.insufficientFunds); }
                    const key = `dice:reset:${createStorageId()}`;
                    economy.postAction({ legs: [{ idempotencyKey: key, actionId: key,
                        fromAccountId: 'player', toAccountId: 'system:sink', amount: COC7_RESET_COST,
                        kind: 'coc7_reset', title: copy.resetTransactionTitle, sourceId: key }] });
                }
                current.sheet = validated;
                transaction.replace(current);
            }, { commitGuard: guard });
            if (result.status === 'unconfirmed' || result.status === 'conflict') { throw new Error(copy.saveUnconfirmed); }
            if (result.status === 'failed') { throw new Error(result.error.message); }
        },
    };
}
export type DiceSheetService = ReturnType<typeof createDiceSheetService>;
