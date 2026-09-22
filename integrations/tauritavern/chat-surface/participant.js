import { TAURITAVERN_ERROR_CODES, TAURITAVERN_MESSAGES } from '../diagnostics.js';

export const CHAT_SURFACE_PROTOCOL_VERSION = 1;
export const LITTLEWHITEBOX_PARTICIPANT_ID = 'littlewhitebox/message-runtime';

export function registerTauriTavernChatSurfaceParticipant({
    environment,
    prepareContent,
    didMount,
    didCommitContent,
}) {
    if (!environment.managed) return null;

    const api = environment.api;
    if (api?.protocolVersion !== CHAT_SURFACE_PROTOCOL_VERSION || typeof api.registerParticipant !== 'function') {
        const error = new Error(TAURITAVERN_MESSAGES.unavailableChatSurface(CHAT_SURFACE_PROTOCOL_VERSION));
        error.code = TAURITAVERN_ERROR_CODES.unavailableChatSurface;
        throw error;
    }

    return api.registerParticipant({
        id: LITTLEWHITEBOX_PARTICIPANT_ID,
        protocolVersion: CHAT_SURFACE_PROTOCOL_VERSION,
        prepareContent,
        didMount,
        ...(didCommitContent ? { didCommitContent } : {}),
    });
}
