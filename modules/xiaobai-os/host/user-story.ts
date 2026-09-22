import type { CapturedChatBinding, ChatReferencePort, XiaobaiOsSidecarV1 } from '../kernel/contracts.js';
import type { ChatBindingManager } from '../storage/chat-binding.js';

const unconfirmed = (status: string) => Object.assign(new Error('Story reference is not confirmed'), { code: `storage_${status}` });
const changed = () => new Error('Chat changed while preparing its reference');

/** Financial story IDs must be confirmed by the chat owner, not inferred from local metadata. */
export function createUserStoryResolver(options: {
    ready(): Promise<void>;
    references: ChatReferencePort;
    manager: ChatBindingManager;
    install(envelope: XiaobaiOsSidecarV1): Promise<void>;
}): (write: boolean) => Promise<CapturedChatBinding> {
    return async write => {
        await options.ready();
        const requested = options.references.capture();
        if (!requested) { throw new Error('No chat is open'); }
        // Views remain readable while reference persistence needs a retry. Only a
        // business write may resume that installation, before preparing any money.
        if (!write) { return requested; }
        let resolved = await options.manager.retryPendingCurrent();
        if (resolved.status === 'empty') { resolved = await options.manager.ensureCurrent(); }
        if (resolved.status !== 'ready') {
            throw unconfirmed(resolved.status);
        }
        const current = options.references.capture();
        if (!current || current.identityKey !== requested.identityKey) { throw changed(); }
        // The chat transaction coordinator can also have installed an unconfirmed
        // reference. Its presence in memory is not a persistence acknowledgement.
        const installed = await options.references.install(current, { formatVersion: 1, osId: resolved.envelope.osId });
        if (installed.status !== 'confirmed') {
            throw unconfirmed(installed.status);
        }
        if (resolved.created) { await options.install(resolved.envelope); }
        if (!await options.references.isCurrent(current)) { throw changed(); }
        return current;
    };
}
