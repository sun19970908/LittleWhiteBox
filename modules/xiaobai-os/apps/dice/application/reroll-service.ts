import { ECONOMY_TRANSACTION_CAPABILITY, type EconomyReadCapability } from '../../../capabilities/economy/index.js';
import type { PartitionStore, XiaobaiOsFileControls } from '../../../kernel/contracts.js';
import { createStorageId } from '../../../kernel/identity.js';
import type { DiceData } from '../partition.js';
import { DICE_REROLL_COST, replaceCheck, rerollCheck, terminalCheck } from '../domain/reroll.js';
import { createResultOverride, type DiceResultOverride } from '../domain/result-override.js';
import { parseDiceRecords } from '../domain/check-records.js';
import { DiceOperationError } from './operation-error.js';
import type { DiceResults } from './results.js';

export interface RerollTarget { body: string; records: unknown }
export const DICE_SAVE_RETRY_DELAYS = [300, 600, 1000] as const;
const REROLL_TRANSACTION_TITLE = '骰子重掷';

/** A delivered roll never waits for accounting. Only this page's short retry owns the candidate. */
export function createDiceRerollService<T extends RerollTarget>(store: PartitionStore<DiceData>, files: XiaobaiOsFileControls,
    economy: Pick<EconomyReadCapability, 'getPlayerBalance' | 'getFileState'>, results: DiceResults,
    current: (target: T) => boolean,
    options: { random?: () => number; id?: () => string; wait?: (ms: number) => Promise<void>; onError(error: unknown): void }) {
    const consumed = new WeakSet<T>();
    const attempts = new Set<AbortController>();
    let queue = Promise.resolve();
    let disposed = false;
    let clearing = false;
    const wait = options.wait ?? (ms => new Promise(resolve => globalThis.setTimeout(resolve, ms)));
    const canAfford = () => economy.getFileState() !== 'ready' || economy.getPlayerBalance() >= DICE_REROLL_COST;

    async function persist(checkId: string, override: DiceResultOverride): Promise<void> {
        const controller = new AbortController();
        attempts.add(controller);
        let pending = false;
        const delivered = () => store.peekCurrent()?.value?.resultOverrides[checkId]?.version === override.version;
        let failure: unknown;
        try {
            for (let attempt = 0; attempt <= DICE_SAVE_RETRY_DELAYS.length && !disposed; attempt++) {
                if (attempt) { await wait(DICE_SAVE_RETRY_DELAYS[attempt - 1]!); }
                if (disposed) { break; }
                try {
                    if (pending) {
                        // Read before retrying the exact prepared transaction, never sample or charge again.
                        const observed = await files.retryPending({ readOnly: true });
                        if (delivered()) { return; }
                        if (pending && observed.status === 'conflict') {
                            await files.adoptServerState(() => pending);
                            if (delivered()) { return; }
                        }
                        if (pending) {
                            await files.retryPending({ beforeRetry: () => pending && !controller.signal.aborted });
                            if (delivered()) { return; }
                            continue;
                        }
                    }
                    let settled = false;
                    const result = await store.transact(transaction => {
                        const data = transaction.currentOrInitial();
                        if (data.resultOverrides[checkId]?.version === override.version) { return; }
                        transaction.replace({ ...data, resultOverrides: { ...data.resultOverrides, [checkId]: override } });
                        const wallet = transaction.useCapability(ECONOMY_TRANSACTION_CAPABILITY);
                        // A concurrent purchase can consume the balance after the click. Keep the delivered roll free.
                        if (wallet.getPlayerBalance() < DICE_REROLL_COST) { return; }
                        const chargeId = `dice:reroll:${override.version}`;
                        wallet.postAction({ legs: [{ idempotencyKey: chargeId, actionId: chargeId, sourceId: override.version,
                            fromAccountId: 'player', toAccountId: 'counterparty:dice:reroll', amount: DICE_REROLL_COST,
                            kind: 'dice_reroll', title: REROLL_TRANSACTION_TITLE }] });
                    }, { signal: controller.signal, abandonOnAbort: true, discardRejectedCandidate: true,
                        onSettled: () => { pending = false; settled = true; } });
                    if (result.status === 'confirmed' || result.status === 'unchanged') { return; }
                    pending = !settled && (result.status === 'unconfirmed' || result.status === 'conflict');
                } catch (error) {
                    // Native fetch read failures can be TypeError too; preserve the cause
                    // and report it once after the same bounded retry schedule.
                    failure = error;
                }
            }
            if (delivered()) { return; }
            throw new DiceOperationError('dice_result_save_failed', { cause: failure });
        } finally {
            // Release only this operation's candidate, even when read-back is unavailable.
            // A confirmed server write is never reverted or charged again.
            controller.abort();
            attempts.delete(controller);
        }
    }

    return {
        dispose() { disposed = true; for (const attempt of attempts) { attempt.abort(); } },
        canAfford,
        reroll(target: T): { target: T; operationId: string; saved: Promise<void> } {
            if (disposed || clearing || consumed.has(target) || !current(target)) { throw new DiceOperationError('dice_target_changed'); }
            if (!canAfford()) {
                throw new DiceOperationError('dice_insufficient_funds');
            }
            const check = terminalCheck(target.body, target.records);
            if (!check) { throw new DiceOperationError('dice_target_changed'); }
            consumed.add(target);
            const operationId = (options.id ?? createStorageId)();
            const record = rerollCheck(check, options.random ?? Math.random);
            const override = createResultOverride(record, operationId);
            results.apply(record.id, override);
            const saved = queue.then(() => persist(record.id, override)).catch(options.onError);
            queue = saved;
            return { target: { ...target, records: replaceCheck(parseDiceRecords(target.records), record) }, operationId, saved };
        },
        async clearResults(checkIds: ReadonlySet<string>) {
            clearing = true;
            const controller = new AbortController();
            attempts.add(controller);
            try {
                await queue;
                const result = await store.transact(transaction => {
                    const data = transaction.currentOrInitial();
                    transaction.replace({ ...data, resultOverrides: Object.fromEntries(
                        Object.entries(data.resultOverrides).filter(([id]) => !checkIds.has(id))) });
                }, { signal: controller.signal, abandonOnAbort: true });
                if (result.status !== 'confirmed' && result.status !== 'unchanged') { throw new DiceOperationError('dice_result_save_failed'); }
                results.forget(checkIds);
            } finally { controller.abort(); attempts.delete(controller); clearing = false; }
        },
        idle: () => queue,
    };
}
export type DiceRerollService<T extends RerollTarget> = ReturnType<typeof createDiceRerollService<T>>;
