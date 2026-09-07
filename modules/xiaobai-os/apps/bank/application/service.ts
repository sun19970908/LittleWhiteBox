import {
    ECONOMY_TRANSACTION_CAPABILITY,
    type EconomyReadCapability,
    type EconomyTransactionCapability,
} from '../../../capabilities/economy/index.js';
import type {
    PendingCommitRecoveryResult,
    ScopedChatStore,
    XiaobaiOsFileControls,
    XiaobaiOsFileState,
} from '../../../kernel/contracts.js';
import { bankRandomSource } from '../../../domains/bank/random.js';
import { appendBankEvent, replayBankEvents } from '../../../domains/bank/timeline.js';
import {
    throwBankError,
    type BankAction,
    type BankCasToken,
    type BankClientView,
    type BankDepositProductId,
    type BankDomainV1,
    type BankEventResult,
    type BankFundProductId,
    type BankRandomSource,
    type BankState,
} from '../../../domains/bank/types.js';
import { createBankView, type CreateBankViewInput } from '../../../domains/bank/view.js';
import {
    assertActionId,
    assertCas,
    replayMatches,
    type BankCommandInput,
} from './action-policy.js';
import { createBankCommands } from './commands.js';
import {
    buildBankEconomyLegs,
    validateBankEconomyConsistency,
} from './economy-protocol.js';

export interface BankServiceView extends BankClientView {
    balance: number;
    writeState: XiaobaiOsFileState;
}

export type BankReadOptions = Pick<CreateBankViewInput, 'activityOffset' | 'activityLimit'>;

export interface BankServiceCommand extends BankCasToken {
    actionId: string;
}

export interface BankOpenDepositCommand extends BankServiceCommand {
    productId: BankDepositProductId;
    amount: number;
}

export interface BankWithdrawDepositCommand extends BankServiceCommand {
    positionId: string;
}

export interface BankOpenFundCommand extends BankServiceCommand {
    productId: BankFundProductId;
    amount: number;
}

export type BankSettleDueCommand = BankServiceCommand;

export interface BankService {
    readCurrent(options?: BankReadOptions): BankServiceView;
    refreshCurrent(options?: BankReadOptions): Promise<BankServiceView>;
    openDeposit(input: BankOpenDepositCommand): Promise<BankServiceView>;
    withdrawDeposit(input: BankWithdrawDepositCommand): Promise<BankServiceView>;
    openFund(input: BankOpenFundCommand): Promise<BankServiceView>;
    settleDue(input: BankSettleDueCommand): Promise<BankServiceView>;
    confirmPending(): Promise<PendingCommitRecoveryResult>;
    getWriteState(): XiaobaiOsFileState;
    subscribe(listener: () => void): () => void;
    dispose(): void;
}

export interface BankServiceDependencies {
    now?: () => number;
    createEventId?: () => string;
    createPositionId?: () => string;
    createActivityId?: () => string;
    random?: BankRandomSource;
    getCurrentAssistantTurn?: () => number;
    isMainGenerationActive?: () => boolean;
}

export interface PreparedBankAction {
    domain: BankDomainV1;
    state: BankState;
    assistantTurn: number;
    playerBalance: number;
}

export type RunBankAction = (
    kind: BankAction['kind'],
    input: BankCommandInput,
    create: (prepared: PreparedBankAction) => {
        eventId: string;
        command: BankAction;
        result: BankEventResult;
    },
) => Promise<BankServiceView>;

interface PreparedResult {
    domain: BankDomainV1;
    assistantTurn: number;
    playerBalance: number;
}

function defaultId(prefix: string): string {
    const suffix = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${suffix}`;
}

function transactionError(result: {
    status: 'failed' | 'unconfirmed' | 'conflict';
    error?: { code: string; message: string; retryable: boolean };
}): Error {
    const code = result.error?.code
        ?? (result.status === 'unconfirmed' ? 'SAVE_UNCONFIRMED' : 'SAVE_CONFLICT');
    return Object.assign(new Error(result.error?.message || code), {
        code,
        retryable: result.error?.retryable ?? true,
        uncertain: result.status === 'unconfirmed',
    });
}

export function createBankService(
    store: ScopedChatStore<BankDomainV1>,
    files: XiaobaiOsFileControls,
    economy: EconomyReadCapability,
    {
        now = Date.now,
        createEventId = () => defaultId('bank-event'),
        createPositionId = () => defaultId('bank-position'),
        createActivityId = () => defaultId('bank-activity'),
        random = bankRandomSource,
        getCurrentAssistantTurn = () => 0,
        isMainGenerationActive = () => false,
    }: BankServiceDependencies = {},
): BankService {
    const listeners = new Set<() => void>();
    const publish = (): void => {
        for (const listener of listeners) {
            try { listener(); } catch (error) {
                console.error('[LittleWhiteBox] Bank state listener failed', error);
            }
        }
    };
    const unsubscribeStore = store.subscribe(publish);
    const unsubscribeEconomy = economy.subscribe(publish);
    const unsubscribeFiles = files.subscribeFileState(publish);
    const currentDomain = (): BankDomainV1 | null => store.peekCurrent()?.value ?? null;

    function buildView(
        domain: BankDomainV1 | null,
        currentTurn: number,
        playerBalance: number,
        options: BankReadOptions = {},
    ): BankServiceView {
        return {
            ...createBankView({ domain, currentTurn, ...options }),
            balance: playerBalance,
            writeState: files.getFileState(),
        };
    }

    function readCurrent(options: BankReadOptions = {}): BankServiceView {
        return buildView(currentDomain(), getCurrentAssistantTurn(), economy.getPlayerBalance(), options);
    }

    async function refreshCurrent(options: BankReadOptions = {}): Promise<BankServiceView> {
        await economy.refresh();
        await store.read();
        return readCurrent(options);
    }

    const runAction: RunBankAction = async (kind, input, create) => {
        let replayed = false;
        const assertGenerationIdle = (): void => {
            if (isMainGenerationActive()) { throw new Error('bank_main_generation_active'); }
        };
        const result = await store.transact(transaction => {
            const transactionEconomy: EconomyTransactionCapability = transaction.useCapability(
                ECONOMY_TRANSACTION_CAPABILITY,
            );
            const domain = transaction.currentOrInitial();
            validateBankEconomyConsistency(domain, transactionEconomy);
            const assistantTurn = getCurrentAssistantTurn();
            const existing = domain.events.find(event => event.actionId === input.actionId);
            if (existing) {
                if (!replayMatches(existing, kind, input)) { throwBankError('bank_action_conflict'); }
                replayed = true;
                return {
                    domain,
                    assistantTurn,
                    playerBalance: transactionEconomy.getPlayerBalance(),
                };
            }

            assertGenerationIdle();
            assertActionId(input.actionId);
            assertCas(domain, input);
            const prepared: PreparedBankAction = {
                domain,
                state: replayBankEvents(domain),
                assistantTurn,
                playerBalance: transactionEconomy.getPlayerBalance(),
            };
            const action = create(prepared);
            const appended = appendBankEvent(domain, {
                ...input,
                eventId: action.eventId,
                command: action.command,
                result: action.result,
                assistantTurn,
                createdAt: now(),
            });
            const legs = buildBankEconomyLegs(appended.event);
            if (legs.length === 0) { throwBankError('bank_no_due_positions'); }
            transactionEconomy.postAction({ legs });
            transaction.replace(appended.domain);
            validateBankEconomyConsistency(appended.domain, transactionEconomy);
            return {
                domain: appended.domain,
                assistantTurn,
                playerBalance: transactionEconomy.getPlayerBalance(),
            };
        }, {
            commitGuard() {
                if (!replayed) { assertGenerationIdle(); }
                return true;
            },
        });

        if (result.status === 'failed' || result.status === 'unconfirmed' || result.status === 'conflict') {
            throw transactionError(result);
        }
        const prepared: PreparedResult = result.result;
        return buildView(prepared.domain, prepared.assistantTurn, prepared.playerBalance);
    };

    const commands = createBankCommands({
        createActivityId,
        createEventId,
        createPositionId,
        random,
        runAction,
    });

    return Object.freeze({
        readCurrent,
        refreshCurrent,
        ...commands,
        confirmPending: files.retryPending,
        getWriteState: files.getFileState,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            unsubscribeStore();
            unsubscribeEconomy();
            unsubscribeFiles();
            listeners.clear();
        },
    });
}
