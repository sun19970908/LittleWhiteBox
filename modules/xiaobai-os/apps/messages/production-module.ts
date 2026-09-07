import type { MainGenerationRuntime } from '../../host/main-generation-runtime.js';
import { saveBase64AsFile } from '../../../../../../../utils.js';
import { createMessageImages } from './host/image-attachments.js';
import { getSillyTavernChatSurface } from '../../host/sillytavern-context.js';
import { createMessagesModule } from './module.js';
import { createMessagesTimeline } from './application/timeline.js';
import { createMessagesChatAdapter } from './host/chat-adapter.js';
import { createMessagesContext } from './host/context-adapter.js';
import { createMessagesMedia } from './host/media-adapter.js';
import { createMessagesRuntime } from './host/runtime.js';
import { createMessagesController } from './host/controller.js';
import { renderPrivateMessages } from './host/message-renderer.js';
import { createMessageId } from './application/identity.js';
import { privateMessagesStableEnd } from './application/summary-boundary.js';
import { registerSummarySourceBoundary } from '../../../story-summary/generate/source-boundary.js';

export function createProductionMessagesModule(mainGeneration: MainGenerationRuntime) {
    return createMessagesModule(async (service, agent) => {
        const chat = createMessagesChatAdapter(mainGeneration.isActive);
        const context = createMessagesContext(chat.port);
        const id = createMessageId;
        const timeline = createMessagesTimeline(service, chat.port, id);
        const media = createMessagesMedia();
        let controller: ReturnType<typeof createMessagesController>;
        const runtime = createMessagesRuntime({ service, timeline, context, agent, id, images: createMessageImages(saveBase64AsFile),
            identity: chat.port.identity, isGenerating: mainGeneration.isActive,
            playerName: () => getSillyTavernChatSurface()?.playerName ?? '玩家',
            changed: () => controller?.emit(),
        });
        const render = () => renderPrivateMessages(chat.port.messages());
        controller = createMessagesController({ service, timeline, context, media, runtime,
            identity: chat.port.identity, isGenerating: mainGeneration.isActive,
            subscribeGeneration: mainGeneration.subscribe,
            subscribeChat(listener) {
                const release = registerSummarySourceBoundary(privateMessagesStableEnd);
                render();
                const unsubscribe = chat.subscribe(listener, render);
                return () => {unsubscribe(); release();};
            },
        });
        return controller;
    });
}
