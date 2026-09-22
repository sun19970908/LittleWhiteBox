import { assertManagedFeaturesSupported } from './feature-policy.js';
import { registerTauriTavernChatSurfaceParticipant } from './chat-surface/participant.js';

// Admission belongs to integration composition, not to the host protocol.
export function registerTauriTavernIntegration(input) {
    if (!input.environment.managed) return null;
    assertManagedFeaturesSupported(input);
    return registerTauriTavernChatSurfaceParticipant(input);
}
