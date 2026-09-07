import {
    createPromptContextAdapter,
} from '../../../host/prompt-context/adapter.js';
import type { PromptContextAdapter, PromptContextCaptureOptions } from '../../../host/prompt-context/types.js';
import type { WorldContextCapability } from '../../world/context-capability.js';
import { normalizeTaskGenerationContext } from '../generation/context.js';
import type { TaskGenerationContext } from '../generation/types.js';

export interface TaskGenerationCapture {
    readonly chatIdentity: string;
    readonly contextSnapshot: TaskGenerationContext;
    readonly assistantCount: number;
}

export interface TaskGenerationContextAdapter {
    currentChatIdentity: () => string;
    capture: (options?: Pick<PromptContextCaptureOptions, 'includeWorldInfo'>) => Promise<TaskGenerationCapture>;
}

interface TaskGenerationContextAdapterDependencies {
    readonly promptContext?: PromptContextAdapter;
    readonly readMapContext?: () => string;
    readonly readWorldContext?: WorldContextCapability['readCurrent'];
}

export function createTaskGenerationContextAdapter({
    promptContext = createPromptContextAdapter(),
    readMapContext = () => '',
    readWorldContext = () => null,
}: TaskGenerationContextAdapterDependencies = {}): TaskGenerationContextAdapter {
    function currentChatIdentity(): string {
        return promptContext.currentChatIdentity();
    }

    async function capture(options?: Pick<PromptContextCaptureOptions, 'includeWorldInfo'>): Promise<TaskGenerationCapture> {
        const captured = await promptContext.capture(options);
        const mapContext = readMapContext();
        const worldContent = readWorldContext(captured.chatIdentity);
        if (currentChatIdentity() !== captured.chatIdentity) {throw new Error('tasks_chat_changed');}
        return {
            chatIdentity: captured.chatIdentity,
            assistantCount: captured.assistantCount,
            contextSnapshot: normalizeTaskGenerationContext({
                ...captured.contextSnapshot,
                mapContext,
                worldContent,
            }),
        };
    }

    return Object.freeze({ currentChatIdentity, capture });
}
