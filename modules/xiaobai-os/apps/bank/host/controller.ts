import type {
    BankOpenDepositCommand,
    BankOpenFundCommand,
    BankService,
    BankServiceView,
    BankSettleDueCommand,
    BankWithdrawDepositCommand,
} from '../application/service.js';
import type { EconomyReadCapability } from '../../../capabilities/economy/index.js';
import type { XiaobaiOsExecutionScope } from '../../../kernel/execution-scope.js';
import type { XiaobaiOsHostFrameMessage } from '../../../host/frame-bridge.js';
import type {
    XiaobaiOsAppActivationContext,
    XiaobaiOsAppRuntime,
    XiaobaiOsChatIdentity,
} from '../../../types.js';
import type { BankActivityPageView, BankClientState } from '../types.js';
import { presentBankActivityPage, presentBankState } from './presentation.js';

type UnknownRecord = Record<string, unknown>;
const BANK_ACTIVITY_PAGE_SIZE = 50;

interface BankActivation {
    chatIdentity: string;
    post: XiaobaiOsAppActivationContext['post'];
}

interface BankControllerDependencies {
    bank: BankService;
    economy: EconomyReadCapability;
    getChatIdentity: () => XiaobaiOsChatIdentity | { key?: unknown } | string | null;
    isMainGenerationActive: () => boolean;
    subscribeGeneration: (listener: () => void) => () => void;
    execution?: XiaobaiOsExecutionScope;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identityKey(identity: ReturnType<BankControllerDependencies['getChatIdentity']>): string {
    return typeof identity === 'string' ? identity : String(identity?.key || '');
}

function isUnconfirmedSave(error: unknown): boolean {
    return isRecord(error) && (error.code === 'SAVE_UNCONFIRMED' || error.uncertain === true);
}

function requireString(value: unknown, name: string): string {
    const result = typeof value === 'string' ? value.trim() : '';
    if (!result || Array.from(result).length > 200) {throw new Error(`${name}无效`);}
    return result;
}

function requireAmount(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        throw new Error('开户金额无效');
    }
    return value;
}

function requireCas(payload: UnknownRecord): { expectedRevision: number; expectedEventId: string } {
    const expectedRevision = payload.expectedRevision;
    const expectedEventId = payload.expectedEventId;
    if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || typeof expectedEventId !== 'string' || expectedEventId !== expectedEventId.trim()
        || Array.from(expectedEventId).length > 200
        || (expectedRevision === 0) !== (expectedEventId === '')) {
        throw new Error('银行状态版本无效');
    }
    return { expectedRevision, expectedEventId };
}

export function createBankController({
    bank,
    economy,
    getChatIdentity,
    isMainGenerationActive,
    subscribeGeneration,
    execution,
}: BankControllerDependencies): XiaobaiOsAppRuntime & {
    activate: NonNullable<XiaobaiOsAppRuntime['activate']>;
    handleMessage: NonNullable<XiaobaiOsAppRuntime['handleMessage']>;
} {
    let activation: BankActivation | null = null;
    let preparation: { activation: BankActivation; error: string } | null = null;
    let busy = false;
    let unsubscribeGeneration: (() => void) | null = null;
    let unsubscribeEconomy: (() => void) | null = null;

    function currentChatIdentity(): string {
        return identityKey(getChatIdentity());
    }

    function assertActivation(payload: UnknownRecord = {}): BankActivation {
        if (!activation) {throw new Error('银行 APP 未激活');}
        const current = currentChatIdentity();
        if (!current || current !== activation.chatIdentity || String(payload.chatIdentity || '') !== current) {
            throw new Error('聊天已切换，请重新打开银行');
        }
        return activation;
    }

    function assertSameActivation(expected: BankActivation, payload: UnknownRecord = {}): void {
        if (assertActivation(payload) !== expected) {throw new Error('银行页面已切换，请重试');}
    }

    function present(chatIdentity: string, serviceView: BankServiceView): BankClientState {
        const next = presentBankState({
            chatIdentity,
            serviceView,
            generationActive: isMainGenerationActive(),
        });
        if (!preparation || preparation.activation !== activation) {return next;}
        if (preparation.error) {
            return { ...next, status: 'blocked', statusLabel: '暂时不可用', message: preparation.error };
        }
        if (next.status === 'unconfirmed' || next.status === 'conflict') {return next;}
        return { ...next, status: 'loading', statusLabel: '正在载入', message: '' };
    }

    function buildState(chatIdentity: string): BankClientState {
        return present(chatIdentity, bank.readCurrent({ activityOffset: 0, activityLimit: BANK_ACTIVITY_PAGE_SIZE }));
    }

    function postState(current: BankActivation, state: BankClientState): BankClientState {
        current.post('bank/state', { state });
        return state;
    }

    function emitState(current = activation): BankClientState {
        if (!current) {throw new Error('银行 APP 未激活');}
        return postState(current, buildState(current.chatIdentity));
    }

    async function prepare(): Promise<void> {
        if (economy.isOpen()) {return;}
        try {
            await economy.ensureOpen();
        } catch (error) {
            if (!isUnconfirmedSave(error)) {throw error;}
        }
    }

    function schedulePreparation(current: BankActivation): void {
        const pending = { activation: current, error: '' };
        preparation = pending;
        const prepareCurrent = () => {
            if (preparation !== pending || activation !== current || currentChatIdentity() !== current.chatIdentity) {return;}
            void prepare().then(() => {
                if (preparation !== pending || activation !== current || currentChatIdentity() !== current.chatIdentity) {return;}
                preparation = null;
                emitState(current);
            }).catch((error) => {
                if (preparation !== pending || activation !== current || currentChatIdentity() !== current.chatIdentity) {return;}
                console.error('[LittleWhiteBox] 银行数据准备失败', error);
                preparation = { activation: current, error: '银行数据暂时无法读取，请稍后重试。' };
                emitState(current);
            });
        };
        if (execution) {execution.setTimeout(prepareCurrent, 0);}
        else {globalThis.setTimeout(prepareCurrent, 0);}
    }

    function activate(context: XiaobaiOsAppActivationContext): BankClientState {
        cancelForeground();
        const chatIdentity = currentChatIdentity();
        if (!chatIdentity) {throw new Error('请先打开一个聊天');}
        const current = { chatIdentity, post: context.post };
        activation = current;
        if (!economy.isOpen()) {schedulePreparation(current);}
        return buildState(chatIdentity);
    }

    function cancelForeground(): void {
        activation = null;
        preparation = null;
        busy = false;
    }

    async function serializeWrite<T, R>(
        current: BankActivation,
        payload: UnknownRecord,
        command: () => Promise<T>,
        completed: (result: T) => R,
    ): Promise<R> {
        if (busy) {throw new Error('已有银行操作正在处理');}
        busy = true;
        try {
            const result = await command();
            assertSameActivation(current, payload);
            return completed(result);
        } catch (error) {
            if (activation === current && currentChatIdentity() === current.chatIdentity && isUnconfirmedSave(error)) {
                emitState(current);
            }
            throw error;
        } finally {
            if (activation === current) {busy = false;}
        }
    }

    function writeState(
        current: BankActivation,
        payload: UnknownRecord,
        command: () => Promise<BankServiceView>,
    ): Promise<BankClientState> {
        return serializeWrite(current, payload, command, (serviceView) => (
            postState(current, present(current.chatIdentity, serviceView))
        ));
    }

    async function handleMessage(message: XiaobaiOsHostFrameMessage): Promise<unknown> {
        const payload = isRecord(message.payload) ? message.payload : {};
        const current = assertActivation(payload);
        if (message.type === 'bank/refresh') {
            if (busy) {throw new Error('已有银行操作正在处理');}
            preparation = null;
            if (typeof bank.refreshCurrent === 'function') { await bank.refreshCurrent(); }
            await prepare();
            assertSameActivation(current, payload);
            return emitState(current);
        }
        if (message.type === 'bank/records/load-more') {
            if (busy) {throw new Error('已有银行操作正在处理');}
            const offset = payload.offset;
            if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 1) {
                throw new Error('银行记录游标无效');
            }
            const page: BankActivityPageView = presentBankActivityPage(bank.readCurrent({
                activityOffset: offset,
                activityLimit: BANK_ACTIVITY_PAGE_SIZE,
            }));
            assertSameActivation(current, payload);
            return page;
        }
        if (message.type === 'bank/confirm-save') {
            preparation = null;
            return serializeWrite(current, payload, () => bank.confirmPending(), (confirmation) => ({
                confirmation: confirmation.status,
                state: emitState(current),
            }));
        }
        const base = {
            ...requireCas(payload),
            actionId: requireString(payload.actionId, '操作标识'),
        };
        if (message.type === 'bank/deposit/open') {
            const input: BankOpenDepositCommand = {
                ...base,
                productId: requireString(payload.productId, '存单产品') as BankOpenDepositCommand['productId'],
                amount: requireAmount(payload.amount),
            };
            return writeState(current, payload, () => bank.openDeposit(input));
        }
        if (message.type === 'bank/deposit/withdraw') {
            const input: BankWithdrawDepositCommand = {
                ...base,
                positionId: requireString(payload.positionId, '存单头寸'),
            };
            return writeState(current, payload, () => bank.withdrawDeposit(input));
        }
        if (message.type === 'bank/fund/open') {
            const input: BankOpenFundCommand = {
                ...base,
                productId: requireString(payload.productId, '理财产品') as BankOpenFundCommand['productId'],
                amount: requireAmount(payload.amount),
            };
            return writeState(current, payload, () => bank.openFund(input));
        }
        if (message.type === 'bank/settle-due') {
            const input: BankSettleDueCommand = base;
            return writeState(current, payload, () => bank.settleDue(input));
        }
        throw new Error('未知的银行操作');
    }

    function handleExternalState(): void {
        const current = activation;
        if (
            !current
            || currentChatIdentity() !== current.chatIdentity
        ) {return;}
        try {
            emitState(current);
        } catch (error) {
            current.post('bank/error', { message: error instanceof Error ? error.message : String(error) });
        }
    }

    return Object.freeze({
        activate,
        deactivate: cancelForeground,
        cancelForeground,
        cancelAll: cancelForeground,
        handleChatChanged: cancelForeground,
        handleMessage,
        startBackground() {
            if (!unsubscribeGeneration) {unsubscribeGeneration = subscribeGeneration(() => handleExternalState());}
            if (!unsubscribeEconomy) {unsubscribeEconomy = bank.subscribe(handleExternalState);}
        },
        stopBackground() {
            unsubscribeGeneration?.();
            unsubscribeGeneration = null;
            unsubscribeEconomy?.();
            unsubscribeEconomy = null;
            cancelForeground();
        },
    });
}
