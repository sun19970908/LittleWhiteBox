import type { UserTransactions } from '../../kernel/user-transactions.js';
import { createAppRuntimeGroup } from '../../kernel/runtime-group.js';
import { createAssistantFloorObserver } from '../../host/assistant-floor-observer.js';
import { getSillyTavernChatSurface } from '../../host/sillytavern-context.js';
import { subscribeBankReplies } from '../../host/sillytavern-runtime-adapters.js';
import { createBankController } from './host/controller.js';
import { createBankMaturityRuntime, type BankMaturityNotice } from './host/maturity-runtime.js';
import { createBankModule } from './module.js';

export interface ProductionBankModuleDependencies {
    userTransactions: () => UserTransactions | null;
    notifyMaturity(notice: BankMaturityNotice): void;
}

export function createProductionBankModule(dependencies: ProductionBankModuleDependencies) {
    return createBankModule({
        service: {
            get userTransactions() {return dependencies.userTransactions() ?? undefined;},
        },
        async install({ bank, store, economy, execution }) {
            const controller = createBankController({
                bank,
                economy,
                execution,
            });
            const maturity = createBankMaturityRuntime({ store, notify: dependencies.notifyMaturity });
            const runtime = createAppRuntimeGroup(controller, [maturity]);
            const observer = createAssistantFloorObserver(getSillyTavernChatSurface,
                () => {void bank.advanceTurns(1).catch(error => {
                    console.error('[LittleWhiteBox] 银行计期保存失败', error);
                });});
            let unsubscribe: (() => void) | null = null;
            return {
                ...runtime,
                async startBackground() {
                    await runtime.startBackground?.();
                    unsubscribe ||= subscribeBankReplies(observer);
                },
                async stopBackground() {
                    unsubscribe?.();
                    unsubscribe = null;
                    await runtime.stopBackground?.();
                },
                handleChatChanged() {
                    observer.reset();
                    return runtime.handleChatChanged?.();
                },
            };
        },
        async dispose(runtime) { await runtime.stopBackground?.(); },
    });
}
