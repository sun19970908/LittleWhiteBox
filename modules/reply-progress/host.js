import { getContext } from '../../../../../extensions.js';
import { eventSource, event_types } from '../../../../../events.js';
import { is_group_generating } from '../../../../../group-chats.js';
import { getGenerateUrl, isStreamingEnabled, online_status, setSendButtonState, streamingProcessor } from '../../../../../../script.js';
import { isGenerating } from '../../shared/common/sillytavern-generation-state.js';
import { HOST_CHAT_COMPLETIONS_GENERATE_ENDPOINT } from '../../shared/host-llm/chat-completions/client.js';
import { observeHostRequest } from './request-observer.js';
import { createReplyProgressRuntime } from './runtime.js';

export function createReplyProgressHostRuntime() {
    return createReplyProgressRuntime({
        events: eventSource,
        eventTypes: event_types,
        getTextarea: () => document.querySelector('#send_textarea'),
        getChat: () => getContext().chat,
        getStream: () => streamingProcessor,
        observeRequest: (generation, onRequest) => {
            const { mainApi } = getContext();
            // Other non-streaming APIs have neither a public request signal
            // nor typed final settings. Do not guess from unowned prompt events.
            if (mainApi !== 'openai' && !isStreamingEnabled()) return null;
            return observeHostRequest({
                events: eventSource, eventTypes: event_types,
                endpoint: mainApi === 'openai' ? HOST_CHAT_COMPLETIONS_GENERATE_ENDPOINT : getGenerateUrl(mainApi),
                ...generation, getStream: () => streamingProcessor, onRequest,
            });
        },
        isGenerating: () => isGenerating() || document.body.dataset.generating === 'true',
        markHostPreparing: () => {
            // The outer group call can return for an empty group without
            // releasing the send flag. Track the actual member calls instead.
            if (getContext().groupId && !is_group_generating) return false;
            setSendButtonState(true);
            return true;
        },
        isConnected: () => online_status !== 'no_connection',
    });
}
