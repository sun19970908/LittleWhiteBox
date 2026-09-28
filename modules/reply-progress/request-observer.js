import { REPLY_PROGRESS_ERRORS } from './copy.js';

// ST 1.14/1.18 and TauriTavern expose the stream's AbortSignal, but not the
// non-streaming controller. Chat completions additionally expose typed request
// settings immediately before fetch. Neither a preview nor generateRaw's quiet
// request can claim a foreground request through these boundaries.
export function observeHostRequest({
    events, eventTypes, endpoint, type, previousStream, getStream, onRequest,
    fetchTarget = globalThis,
}) {
    let active = true;
    const candidates = new Set();
    const originalFetch = fetchTarget.fetch;

    function prepared(data) {
        if (active && !data.stream && String(data.type || 'normal') === type) {
            candidates.add(data);
        }
    }

    function matches(init) {
        const stream = getStream();
        if (stream && stream !== previousStream && String(stream.type || 'normal') === type
            && init.signal && init.signal === stream.abortController.signal) return true;
        // Keep the settings object, not a snapshot: later listeners may still
        // edit it. Compare only when fetch is actually called, after all those
        // listeners finish. No prompt copies, header inspection or request /
        // response logging; all settings references are released on cleanup.
        for (const data of candidates) {
            if (init.body === JSON.stringify(data)) return true;
        }
        return false;
    }

    function observedFetch(input, init) {
        // Preserve arguments, receiver, Promise identity and native failures.
        // No await, response consumption, retry or request parameter changes.
        const result = originalFetch.apply(this, arguments);
        if (active && input === endpoint && init?.method === 'POST' && !init.signal?.aborted) {
            try {
                if (matches(init)) onRequest();
            } catch (error) {
                // A diagnostic hint must never break a request already sent.
                console.error(REPLY_PROGRESS_ERRORS.observeRequest, error);
            }
        }
        return result;
    }

    events.makeFirst(eventTypes.CHAT_COMPLETION_SETTINGS_READY, prepared);
    fetchTarget.fetch = observedFetch;
    return () => {
        active = false;
        candidates.clear();
        events.removeListener(eventTypes.CHAT_COMPLETION_SETTINGS_READY, prepared);
        // Another extension may have wrapped fetch after us. Never remove its
        // wrapper; our now-inert layer simply forwards if it is still in use.
        if (fetchTarget.fetch === observedFetch) fetchTarget.fetch = originalFetch;
    };
}
