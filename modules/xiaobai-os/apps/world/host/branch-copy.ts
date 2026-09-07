import type { ChatMetadataCapture } from '../../../storage/chat-reference.js';
import type { XiaobaiOsChatBindingV1 } from '../../../kernel/contracts.js';
import { WORLD_PARTITION } from '../partition.js';

export function copyWorldBranch(capture: ChatMetadataCapture, source: XiaobaiOsChatBindingV1, partitions: Record<string, unknown>): void {
    if (capture.mainChatId !== source.chatId || capture.binding.kind !== source.kind
        || capture.binding.ownerLocator !== source.ownerLocator || !Object.hasOwn(partitions, WORLD_PARTITION.key)) { return; }
    const result = WORLD_PARTITION.parse(partitions[WORLD_PARTITION.key]);
    if (!result.ok) { throw new Error('world_branch_source_invalid'); }
    partitions[WORLD_PARTITION.key] = WORLD_PARTITION.serialize({ ...result.value, overview: '', news: [] });
}
