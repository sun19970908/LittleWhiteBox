import { observeGenerateInterceptors } from '../../shared/common/generate-interceptor.js';
import { createPlaceholderPresenter } from './placeholder.js';

const VISIBLE_TYPES = new Set(['', 'normal', 'regenerate', 'swipe', 'continue']);
const HOST_PHASES = new Set(['assembly', 'request', 'waiting']);

function isVisibleGeneration(type, params, dryRun) {
    return !dryRun && !params?.automatic_trigger && !(params?.quiet_prompt && !params?.quietToLoud)
        && VISIBLE_TYPES.has(String(type || ''));
}

// ST's world-info/prompt/data events have no generation identity, and raw/quiet
// requests and previews emit them too. Never use them to advance this run.
// Our claimed dispatch and the host request observer provide attributable
// boundaries. Hosts without one keep an explicitly unsplit waiting interval.
export function createReplyProgressRuntime({
    events, eventTypes, getTextarea, getChat, getStream, isGenerating, markHostPreparing,
    observeRequest,
    isConnected = () => true,
    now = () => performance.now(),
    schedule = (fn, ms) => setInterval(fn, ms),
    unschedule = timer => clearInterval(timer),
    createPresenter = createPlaceholderPresenter,
}) {
    let enabled = false;
    let run = null;
    let timer = null;
    const listeners = [];
    let unobserveInterceptors = null;

    function stop() {
        if (!run) return;
        run.unobserveRequest?.();
        run.presenter.restore();
        run = null;
        if (timer !== null) {
            unschedule(timer);
            timer = null;
        }
    }

    function setStage(phase, detail = null) {
        if (!run || run.phase === phase && run.detail === detail) return;
        run.phase = phase;
        run.detail = detail;
        run.stageAt = now();
        paint();
    }

    function paint() {
        if (!run) return;
        if (getChat() !== run.chat || !isConnected() || run.dispatch?.signal.aborted) {
            stop();
            return;
        }
        // This is a composer hint, not a concurrent-request tracker. When the
        // host releases its send state, restore the composer even if a
        // background request released it before the foreground finished.
        const busy = isGenerating();
        if (busy) run.seenBusy = true;
        if (run.seenBusy && !busy) {
            stop();
            return;
        }
        if (run.recall) {
            const detail = run.recall.stage;
            if (run.detail !== detail) {
                setStage('recall', detail);
            }
        }
        run.presenter.show({ phase: run.phase, detail: run.detail, elapsedMs: now() - run.stageAt });
    }

    function start(type, params, dryRun, afterCommands = false) {
        if (!isVisibleGeneration(type, params, dryRun)) return;
        stop();
        const textarea = getTextarea();
        if (!textarea || !isConnected()) return;
        run = {
            chat: getChat(),
            type: String(type || 'normal'),
            previousMessage: getChat()?.at(-1),
            previousText: getChat()?.at(-1)?.mes || '',
            previousStream: getStream(),
            phase: 'context',
            detail: null,
            stageAt: now(),
            afterCommands,
            seenBusy: false,
            dispatch: null,
            handler: null,
            recall: null,
            unobserveRequest: null,
            presenter: createPresenter(textarea),
        };
        paint();
        if (run) timer = schedule(paint, 200);
    }

    function onInterceptor({ phase, id, type, run: dispatch, detail }) {
        if (!run || !run.afterCommands || run.chat !== getChat()
            || HOST_PHASES.has(run.phase)
            || !VISIBLE_TYPES.has(String(type || '')) || String(type || 'normal') !== run.type) return;
        if (phase === 'dispatch-start') {
            // Claim through this run's post-command lifecycle, not UI busy:
            // /regenerate does not set busy until after the interceptors.
            // Keep the dispatch identity until stop, including after its end.
            if (run.dispatch) return;
            run.dispatch = dispatch;
            setStage('context');
        } else if (run.dispatch !== dispatch) {
            return;
        } else if (phase === 'handler-progress' && run.handler === 'story-summary') {
            if (detail) {
                run.recall = detail;
                setStage('recall', detail.stage);
            } else if (run.recall) {
                run.recall = null;
                setStage('context');
            }
        } else if (phase === 'handler-start') {
            run.handler = id;
            // A registered summary interceptor also runs when memory is off.
            // Only its explicit progress report proves that recall was joined.
            if (id !== 'story-summary') setStage('interceptor', id);
        } else if (phase === 'handler-end' && run.handler === id) {
            run.handler = null;
            run.recall = null;
            setStage('context');
        } else if (phase === 'dispatch-end') {
            run.handler = null;
            run.recall = null;
            const owner = run;
            owner.unobserveRequest = observeRequest({ type: owner.type, previousStream: owner.previousStream }, () => {
                if (run !== owner) return;
                owner.unobserveRequest?.();
                owner.unobserveRequest = null;
                setStage('request');
            });
            setStage(owner.unobserveRequest ? 'assembly' : 'waiting');
        }
    }

    function on(name, callback) {
        // Observe entry before awaiting existing listeners. This only places
        // our synchronous observer first; other listeners retain their order.
        events.makeFirst(eventTypes[name], callback);
        listeners.push([eventTypes[name], callback]);
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        on('GENERATION_STARTED', (type, params, dryRun) => {
            if (!isVisibleGeneration(type, params, dryRun)) return;
            // A slash command may consume the request before AFTER_COMMANDS and
            // the host emits no completion event for that path.
            if (String(type || 'normal') === 'normal'
                && getTextarea()?.value?.trimStart().startsWith('/')) return;
            start(type, params, dryRun);
        });
        on('GENERATION_AFTER_COMMANDS', (type, params, dryRun) => {
            if (!isVisibleGeneration(type, params, dryRun)) return;
            if (run?.type === String(type || 'normal') && run.chat === getChat()) {
                run.afterCommands = true;
            } else {
                start(type, params, dryRun, true);
            }
            if (!run) return;
            // Like Dice, mark native preparation once after slash commands.
            // ST clears this flag on preflight rejection, even when no stop
            // button was shown and no GENERATION_ENDED event is emitted.
            // Only the host releases it; hiding this hint never unlocks a call.
            if (!markHostPreparing()) {
                stop();
                return;
            }
            paint();
        });
        on('MESSAGE_SENT', index => {
            if (run?.type === 'normal' && !run.dispatch && run.chat === getChat() && run.chat[index]?.is_user) {
                setStage('message');
            }
        });
        on('USER_MESSAGE_RENDERED', index => {
            if (run?.phase === 'message' && run.chat[index]?.is_user) {
                setStage('context');
            }
        });
        on('STREAM_TOKEN_RECEIVED', text => {
            if (!run || !String(text || '').trim() || getChat() !== run.chat) return;
            const stream = getStream();
            if (stream && stream !== run.previousStream && stream.result === text
                && String(stream.type || 'normal') === run.type
                && stream.messageId === run.chat.length - 1) stop();
        });
        on('MESSAGE_RECEIVED', (index, type) => {
            if (!run || !HOST_PHASES.has(run.phase)) return;
            const sameType = String(type || 'normal') === run.type
                || (run.type === 'continue' && type === 'appendFinal')
                || (['regenerate', 'swipe'].includes(run.type) && type === 'normal');
            const chat = getChat();
            if (!sameType || chat !== run.chat || index !== chat.length - 1) return;
            const message = chat[index];
            if (message?.is_user !== false || message.is_system || !String(message.mes || '').trim()) return;
            if (run.type === 'continue' && message === run.previousMessage && message.mes === run.previousText) return;
            stop();
        });
        for (const name of ['GENERATION_ENDED', 'GROUP_WRAPPER_FINISHED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) {
            on(name, stop);
        }
        unobserveInterceptors = observeGenerateInterceptors(onInterceptor);
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        stop();
        for (const [event, callback] of listeners) events.removeListener(event, callback);
        listeners.length = 0;
        unobserveInterceptors?.();
        unobserveInterceptors = null;
    }

    return { setEnabled: value => value ? enable() : disable(), destroy: disable };
}
