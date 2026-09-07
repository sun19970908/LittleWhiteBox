import type { XiaobaiOsChatIdentity } from '../../types.js';
import type { MainGenerationRuntime } from '../../host/main-generation-runtime.js';
import type { XiaobaiOsChatSurface } from '../../host/sillytavern-context.js';
import { createAppRuntimeGroup } from '../../kernel/runtime-group.js';
import { createShopEffectDeliveryQueue } from './application/effect-delivery-queue.js';
import { createShopController } from './host/controller.js';
import { createShopMessageReceipts } from './host/message-receipts.js';
import { createShopPromptRuntime, type ShopPromptEventHandlers } from './host/prompt-runtime.js';
import { createShopModule } from './module.js';

export interface ProductionShopModuleDependencies {
    getChatIdentity: () => XiaobaiOsChatIdentity | null;
    captureChatSurface: () => XiaobaiOsChatSurface | null;
    mainGeneration: MainGenerationRuntime;
    setPrompt(value: string): void;
    subscribePrompt(handlers: ShopPromptEventHandlers): () => void;
}

export function createProductionShopModule(dependencies: ProductionShopModuleDependencies) {
    return createShopModule({
        getChatIdentity: dependencies.getChatIdentity,
        isMainGenerationActive: dependencies.mainGeneration.isActive,
        subscribeGeneration: dependencies.mainGeneration.subscribe,
        createRuntime({ shop, economy, execution }) {
            const receipts = createShopMessageReceipts({ captureChatSurface: dependencies.captureChatSurface });
            const deliveries = createShopEffectDeliveryQueue({
                readCurrent() {
                    const identity = dependencies.getChatIdentity();
                    return identity ? { chatIdentity: identity.key, domain: shop.readCurrent().domain } : null;
                },
                persist: shop.commitDeliveryCurrent,
            });
            const prompt = createShopPromptRuntime({
                captureConversation: receipts.captureConversation,
                readShop: deliveries.readCurrent,
                enqueueDelivery: deliveries.enqueue,
                bindReplyReceipt: receipts.bind,
                setPrompt: dependencies.setPrompt,
                subscribe: dependencies.subscribePrompt,
            });
            let unsubscribeDelivery: (() => void) | null = null;
            const deliveryRuntime = {
                startBackground() {
                    const resume = () => {
                        const identity = dependencies.getChatIdentity();
                        if (identity && shop.getWriteState() === 'ready') { deliveries.resume(identity.key); }
                    };
                    unsubscribeDelivery ||= shop.subscribe(resume);
                    resume();
                },
                handleChatChanged() {
                    const identity = dependencies.getChatIdentity();
                    if (identity) { deliveries.resume(identity.key); }
                },
                stopBackground() {
                    unsubscribeDelivery?.();
                    unsubscribeDelivery = null;
                },
            };
            const controller = createShopController({
                shop,
                economy,
                getChatIdentity: dependencies.getChatIdentity,
                isMainGenerationActive: dependencies.mainGeneration.isActive,
                subscribeGeneration: dependencies.mainGeneration.subscribe,
                execution,
            });
            return createAppRuntimeGroup(controller, [prompt, deliveryRuntime]);
        },
    });
}
