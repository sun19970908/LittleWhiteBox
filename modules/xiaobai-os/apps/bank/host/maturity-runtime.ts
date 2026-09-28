import { createBankView } from '../../../domains/bank/view.js';
import type { BankDomainV1 } from '../../../domains/bank/types.js';
import type { PartitionSnapshot, PartitionStore } from '../../../kernel/contracts.js';
import type { XiaobaiOsAppRuntime } from '../../../types.js';

export interface BankMaturityNotice {
    title: string;
    message: string;
}

const MATURITY_COPY = {
    titles: { deposit: '定期存单已到期', fund: '理财已到期' },
    message: (name: string, amount: number) => `「${name}」已到期，可在小白 OS 银行领取 ${amount.toLocaleString('zh-CN')} 小白币。`,
    baselineReadFailed: '[LittleWhiteBox] 暂时无法读取银行到期通知基线',
    notificationFailed: '[LittleWhiteBox] 银行到期通知未能显示',
};

/** Bank is user-scoped: confirmed maturities notify with the OS closed and across chat changes. */
export function createBankMaturityRuntime(dependencies: {
    store: Pick<PartitionStore<BankDomainV1>, 'peekCurrent' | 'subscribe'>;
    notify(notice: BankMaturityNotice): void;
}): XiaobaiOsAppRuntime {
    let unsubscribe: (() => void) | null = null;
    let initialized = false;
    const seen = new Set<string>();

    function observe(snapshot: PartitionSnapshot<BankDomainV1>): void {
        const view = createBankView({ domain: snapshot.value });
        const baseline = !initialized;
        initialized = true;
        const due = [
            ...view.deposits.filter(position => position.claimable).map(position => ({
                id: position.id, kind: 'deposit' as const, name: position.name, amount: position.maturityAmount,
            })),
            ...view.investments.filter(position => position.claimable).map(position => ({
                id: position.id, kind: 'fund' as const, name: position.name, amount: position.settlementAmount,
            })),
        ];
        for (const position of due) {
            if (seen.has(position.id)) {continue;}
            seen.add(position.id);
            if (baseline) {continue;}
            try {
                dependencies.notify({
                    title: MATURITY_COPY.titles[position.kind],
                    message: MATURITY_COPY.message(position.name, position.amount),
                });
            } catch (error) { console.warn(MATURITY_COPY.notificationFailed, error); }
        }
    }

    return {
        startBackground() {
            if (unsubscribe) {return;}
            try {
                const current = dependencies.store.peekCurrent();
                if (current) {observe(current);}
            } catch (error) { console.warn(MATURITY_COPY.baselineReadFailed, error); }
            unsubscribe = dependencies.store.subscribe(observe);
        },
        stopBackground() {
            unsubscribe?.();
            unsubscribe = null;
            initialized = false;
            seen.clear();
        },
    };
}
