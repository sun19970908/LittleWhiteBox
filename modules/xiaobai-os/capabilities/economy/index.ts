import {
    createCapabilityToken,
    type CapabilityRegistration,
} from '../../kernel/capability-registry.js';
import type {
    CapabilityToken,
    CapabilityTransactionAccess,
    PartitionRegistration,
    ScopedChatStore,
    XiaobaiOsFileControls,
    XiaobaiOsFileState,
} from '../../kernel/contracts.js';
import { validateLedger } from '../../domains/economy/invariants.js';
import {
    ensureEconomy,
    listTransactions,
    postAction,
    projectBalances,
} from '../../domains/economy/ledger.js';
import type {
    EconomyLedgerV2,
    EconomyPostActionResult,
    EconomyTransaction,
    EconomyTransactionPage,
    PostTransactionInput,
} from '../../domains/economy/types.js';

export const ECONOMY_PARTITION_KEY = 'economy';

export interface EconomyReadView {
    getPlayerBalance(): number;
    listTransactions(query?: { beforeSequence?: number; limit?: number }): EconomyTransactionPage;
}

export interface EconomyReadCapability extends EconomyReadView {
    refresh(): Promise<void>;
    isOpen(): boolean;
    ensureOpen(commitGuard?: () => boolean): Promise<'opened' | 'existing'>;
    getTransactionCount(): number;
    getFileState(): XiaobaiOsFileState;
    subscribe(listener: () => void): () => void;
}

export interface EconomyActionLeg extends Omit<PostTransactionInput, 'sourceDomain'> {
    sourceDomain?: never;
}

export interface EconomyActionInput {
    legs: readonly EconomyActionLeg[];
}

export interface EconomyTransactionCapability extends EconomyReadView {
    postAction(input: EconomyActionInput): Omit<EconomyPostActionResult, 'ledger'>;
    listOwnedTransactions(): readonly EconomyTransaction[];
    getAccountBalance(accountId: string): number;
}

export const ECONOMY_READ_CAPABILITY: CapabilityToken<EconomyReadCapability> =
    createCapabilityToken('economy.read');
export const ECONOMY_TRANSACTION_CAPABILITY: CapabilityToken<EconomyTransactionCapability> =
    createCapabilityToken('economy.transaction');

export const ECONOMY_PARTITION: PartitionRegistration<EconomyLedgerV2> = Object.freeze({
    key: ECONOMY_PARTITION_KEY,
    ownerId: 'economy',
    schemaVersion: 2,
    parse(value: unknown) {
        try {
            validateLedger(value);
            return { ok: true as const, value: structuredClone(value) };
        } catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Economy partition is invalid',
                },
            };
        }
    },
    serialize(value: EconomyLedgerV2) {
        validateLedger(value);
        return structuredClone(value);
    },
    createInitial() {
        return ensureEconomy(undefined);
    },
});

function readLedger(access: CapabilityTransactionAccess): EconomyLedgerV2 | null {
    return access.readPartition(ECONOMY_PARTITION);
}

function readonlyTransactionView(access: CapabilityTransactionAccess): EconomyReadView {
    return Object.freeze({
        getPlayerBalance() {
            const ledger = readLedger(access);
            return ledger ? projectBalances(ledger).player ?? 0 : 0;
        },
        listTransactions(query: { beforeSequence?: number; limit?: number } = {}) {
            const ledger = readLedger(access);
            if (ledger) { return listTransactions(ledger, query); }
            const { beforeSequence = Number.POSITIVE_INFINITY, limit = 18 } = query;
            if (!Number.isInteger(limit) || limit < 1 || limit > 100 || typeof beforeSequence !== 'number') {
                throw new TypeError('invalid Economy transaction query');
            }
            return { transactions: [], nextCursor: null, hasMore: false };
        },
    });
}

function transactionCapability(
    access: CapabilityTransactionAccess,
    callerDomain: string,
    accountNamespace: string,
): EconomyTransactionCapability {
    const assertAccount = (accountId: string, direction: 'from' | 'to'): void => {
        const ownedPrefixes = [`counterparty:${accountNamespace}:`, `escrow:${accountNamespace}:`];
        const allowed = accountId === 'player'
            || ownedPrefixes.some(prefix => accountId.startsWith(prefix))
            || direction === 'to' && accountId === 'system:sink';
        if (!allowed) {
            throw Object.assign(new Error(`${callerDomain} cannot post to account ${accountId}`), {
                code: 'economy_account_not_authorized',
            });
        }
    };
    return Object.freeze({
        ...readonlyTransactionView(access),
        postAction(input: EconomyActionInput) {
            const ledger = readLedger(access);
            if (!ledger) {
                throw Object.assign(new Error('Economy account is not open'), {
                    code: 'economy_account_not_open',
                });
            }
            for (const leg of input.legs) {
                assertAccount(leg.fromAccountId, 'from');
                assertAccount(leg.toAccountId, 'to');
            }
            const result = postAction(ledger, input.legs.map(leg => ({
                ...leg,
                sourceDomain: callerDomain,
            })));
            access.replacePartition(ECONOMY_PARTITION, result.ledger);
            return {
                transactions: structuredClone(result.transactions),
                created: result.created,
            };
        },
        listOwnedTransactions() {
            return Object.freeze(
                (readLedger(access)?.transactions ?? [])
                    .filter(transaction => transaction.sourceDomain === callerDomain)
                    .map(transaction => Object.freeze(structuredClone(transaction))),
            );
        },
        getAccountBalance(accountId: string) {
            const ownedPrefixes = [`counterparty:${accountNamespace}:`, `escrow:${accountNamespace}:`];
            if (accountId !== 'player' && !ownedPrefixes.some(prefix => accountId.startsWith(prefix))) {
                throw Object.assign(new Error(`${callerDomain} cannot read account ${accountId}`), {
                    code: 'economy_account_not_authorized',
                });
            }
            const ledger = readLedger(access);
            return ledger ? projectBalances(ledger)[accountId] ?? 0 : 0;
        },
    });
}

function installedReadCapability(
    store: ScopedChatStore<EconomyLedgerV2>,
    files: XiaobaiOsFileControls,
): { capability: EconomyReadCapability; dispose: () => void } {
    const listeners = new Set<() => void>();
    const publish = (): void => {
        for (const listener of listeners) {
            try { listener(); } catch (error) {
                console.error('[LittleWhiteBox] Economy read listener failed', error);
            }
        }
    };
    const unsubscribeStore = store.subscribe(publish);
    const unsubscribeFile = files.subscribeFileState(publish);
    const currentLedger = (): EconomyLedgerV2 | null => store.peekCurrent()?.value ?? null;
    const capability: EconomyReadCapability = Object.freeze({
        async refresh() {
            await store.read();
        },
        isOpen: () => currentLedger() !== null,
        async ensureOpen(commitGuard?: () => boolean) {
            const result = await store.transact(transaction => {
                if (commitGuard && !commitGuard()) { throw new Error('Account opening cancelled'); }
                if (transaction.current) { return 'existing' as const; }
                transaction.replace(transaction.currentOrInitial());
                return 'opened' as const;
            }, { commitGuard });
            if (result.status === 'confirmed' || result.status === 'unchanged') { return result.result; }
            throw Object.assign(new Error(result.status === 'failed'
                ? result.error.message
                : `Economy account opening is ${result.status}`), {
                code: result.status === 'failed' ? result.error.code : `storage_${result.status}`,
                retryable: result.status === 'failed' ? result.error.retryable : true,
                uncertain: result.status === 'unconfirmed',
            });
        },
        getPlayerBalance: () => {
            const ledger = currentLedger();
            return ledger ? projectBalances(ledger).player ?? 0 : 0;
        },
        getTransactionCount: () => currentLedger()?.transactions.length ?? 0,
        listTransactions(query: { beforeSequence?: number; limit?: number } = {}) {
            const ledger = currentLedger();
            if (ledger) { return listTransactions(ledger, query); }
            const { beforeSequence = Number.POSITIVE_INFINITY, limit = 18 } = query;
            if (!Number.isInteger(limit) || limit < 1 || limit > 100 || typeof beforeSequence !== 'number') {
                throw new TypeError('invalid Economy transaction query');
            }
            return { transactions: [], nextCursor: null, hasMore: false };
        },
        getFileState: () => files.getFileState(),
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    });
    return {
        capability,
        dispose() {
            unsubscribeStore();
            unsubscribeFile();
            listeners.clear();
        },
    };
}

export interface EconomyCapabilityRegistrationOptions {
    transactionAccountNamespaces?: Readonly<Record<string, string>>;
}

export const ECONOMY_TRANSACTION_ACCOUNT_NAMESPACES: Readonly<Record<string, string>> = Object.freeze({
    tasks: 'task',
});

export function createEconomyCapabilityRegistrations({
    transactionAccountNamespaces = ECONOMY_TRANSACTION_ACCOUNT_NAMESPACES,
}: EconomyCapabilityRegistrationOptions = {}): readonly CapabilityRegistration<unknown>[] {
    const accountNamespaces = new Map<string, string>();
    for (const [requesterId, namespace] of Object.entries(transactionAccountNamespaces)) {
        if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(requesterId)
            || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(namespace)) {
            throw new TypeError('invalid Economy transaction account namespace');
        }
        accountNamespaces.set(requesterId, namespace);
    }
    const disposers = new WeakMap<object, () => void>();
    return Object.freeze([
        {
            token: ECONOMY_READ_CAPABILITY,
            ownerId: 'economy',
            dependencies: [],
            partition: ECONOMY_PARTITION,
            install(context) {
                if (!context.partition || !context.files) {
                    throw new Error('Economy capability requires its partition store and file controls');
                }
                const installed = installedReadCapability(
                    context.partition as ScopedChatStore<EconomyLedgerV2>,
                    context.files,
                );
                disposers.set(installed.capability, installed.dispose);
                return installed.capability;
            },
            dispose(instance) { disposers.get(instance as object)?.(); },
        },
        {
            token: ECONOMY_TRANSACTION_CAPABILITY,
            ownerId: 'economy',
            dependencies: [],
            bindTransaction: ({ access, requesterId }: {
                access: CapabilityTransactionAccess;
                requesterId: string;
            }) => transactionCapability(access, requesterId, accountNamespaces.get(requesterId) ?? requesterId),
        },
    ] satisfies CapabilityRegistration<unknown>[]);
}
