import { updateMessageBlock } from '../../../../../../../../../script.js';
import { isGenerating } from '../../../host/sillytavern-generation-state.js';
import { createModuleEvents, event_types } from '../../../../../core/event-manager.js';
import { isCheckContinuationPoint, parseDiceRecords, referencedActionChecks } from '../domain/check-records.js';
import { createCheckCard, type CheckCard } from '../ui/check-card.js';
import { diceSpan as span } from '../ui/card-elements.js';
import { revealCheckCard } from '../ui/reveal.js';
import { readDiceRecords, type DiceCandidate, type DiceHostMessage, type DiceTarget } from './message-records.js';
import { captureDiceChat } from './sillytavern-port.js';
import type { createDiceGenerationAdapter } from './generation-adapter.js';
import { DICE_CARD_CSS } from './card-style.js';
import { mountCheckCards, restoreCheckMarker } from './check-marker-dom.js';
import { checkDisplayProjection } from './check-display-projection.js';
import { showCheckReveal } from './reveal-visibility.js';
import { DICE_SESSION_COPY, diceHostWaitLabel, diceContinuationLabel } from '../ui/session-copy.js';

type Runtime = ReturnType<typeof createDiceGenerationAdapter>;
const OWN = '.xb-dice-card';
interface CardEntry { signature: string; view: CheckCard; status: string }

export function createDiceMessageDisplay(runtime: Runtime, enabled: () => boolean) {
    let observer: MutationObserver | null = null;
    let disposeEvents: (() => void) | null = null;
    let frame: number | null = null;
    let progressTimer: ReturnType<typeof setTimeout> | null = null;
    let style: HTMLStyleElement | null = null;
    // Message/candidate identity, not the host's replaceable formatted DOM, owns a mounted card.
    const cards = new WeakMap<DiceHostMessage, { swipe: number; entries: Map<string, CardEntry> }>();
    // Don't repeatedly repaint a source whose markers are suppressed by host formatting.
    const failedSync = new WeakMap<HTMLElement, string>();

    function retryButton(index: number, label: string, action = 'continue-check'): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.dataset.diceAction = action;
        button.addEventListener('click', () => {
            button.disabled = true;
            void runtime.retry(index).catch(error => {
                console.error('[LittleWhiteBox] Dice retry failed', error);
                const note = span('xb-dice-note', DICE_SESSION_COPY.retryFailed);
                note.setAttribute('role', 'alert'); button.after(note);
            }).finally(() => { button.disabled = false; refresh(); });
        });
        return button;
    }

    function setStatus(entry: CardEntry, index: number, error: string, retry: string): void {
        const signature = JSON.stringify([index, error, retry]);
        if (entry.status === signature) { return; }
        entry.status = signature;
        entry.view.status.replaceChildren();
        entry.view.status.hidden = !error && !retry;
        if (error) { entry.view.status.append(span('xb-dice-note', error)); }
        if (retry) { entry.view.status.append(retryButton(index, retry)); }
    }

    function render(): void {
        frame = null;
        if (progressTimer !== null) { clearTimeout(progressTimer); progressTimer = null; }
        let timeContinuation = false;
        observer?.disconnect();
        try {
            const source = captureDiceChat();
            const active = runtime.view();
            // The host owns stream following. Its temporary marker-only layout cannot
            // tell us whether the reader left the bottom; only reveal() positions a new die.
            for (const root of document.querySelectorAll<HTMLElement>('#chat .mes')) {
                const index = Number(root.getAttribute('mesid'));
                const message = source?.chat[index];
                const content = root.querySelector<HTMLElement>('.mes_text');
                if (!content) { continue; }
                const value = message && readDiceRecords(message);
                const current = active && active.target.message === message && active.target.swipe === (message?.swipe_id ?? 0) ? active : null;
                const phase = current?.phase;
                const continuing = phase && 'candidate' in phase && phase.candidate
                    ? referencedActionChecks(phase.candidate.body, phase.candidate.records.checks).at(-1) : undefined;
                const editing = !!root.querySelector('.edit_textarea');
                if (editing) {
                    if (phase) { runtime.cancel(); }
                    continue;
                }
                if (!message || message.is_user || message.is_system) {
                    content.querySelectorAll(OWN).forEach(node => node.remove()); continue;
                }
                const wanted = new Set<HTMLElement>();
                const placements = new Map<string, HTMLElement>();
                let cached = cards.get(message);
                if (!cached || cached.swipe !== (message.swipe_id ?? 0)) {
                    cached = { swipe: message.swipe_id ?? 0, entries: new Map() }; cards.set(message, cached);
                }
                const kept = new Set<string>();
                let errorPlaced = false;
                let projection = message.mes;
                if (value !== undefined) {
                    try {
                        const records = parseDiceRecords(value);
                        projection = checkDisplayProjection(message, records.checks);
                        const referenced = referencedActionChecks(message.mes, records.checks);
                        for (const record of referenced) {
                            const pending = phase?.kind === 'revealing'
                                && phase.candidate.records.checks.at(-1)?.id === record.id;
                            const signature = JSON.stringify(record);
                            let entry = cached.entries.get(record.id);
                            if (!entry || entry.signature !== signature) {
                                entry = { signature, view: createCheckCard(record, !!pending), status: '' };
                                cached.entries.set(record.id, entry);
                            }
                            kept.add(record.id);
                            const { view } = entry;
                            if (!pending && view.element.dataset.state === 'rolling') { view.settle(); }
                            const node = view.element;
                            placements.set(record.id, node);
                            const failedContinuation = phase?.kind === 'continue-error' && continuing?.id === record.id;
                            const waitingForText = phase?.kind === 'continuing'
                                && continuing?.id === record.id
                                && isCheckContinuationPoint(message.mes, record);
                            const waitingForHost = phase?.kind === 'settling' && continuing?.id === record.id;
                            const progress = waitingForText ? current?.continuation : null;
                            timeContinuation ||= !!progress;
                            const error = (failedContinuation || waitingForHost) && current?.wait
                                ? `${diceHostWaitLabel(current.wait)}${failedContinuation ? `。${DICE_SESSION_COPY.retained}` : ''}`
                                : failedContinuation ? phase.error : waitingForText
                                    ? progress ? diceContinuationLabel(progress) : DICE_SESSION_COPY.continuing
                                    : waitingForHost ? DICE_SESSION_COPY.waitingHost : '';
                            let retry = '';
                            if (enabled() && (failedContinuation || source?.chat.at(-1) === message && record === referenced.at(-1)
                                && isCheckContinuationPoint(message.mes, record) && !active)) {
                                retry = DICE_SESSION_COPY.retryContinue;
                            }
                            setStatus(entry, index, error, retry);
                            if (waitingForText || waitingForHost) {
                                view.status.dataset.diceState = waitingForHost ? 'waiting' : progress?.stage ?? 'preparing';
                            } else { delete view.status.dataset.diceState; }
                            if (progress) { view.status.dataset.elapsedSeconds = String(progress.elapsedSeconds); }
                            else { delete view.status.dataset.elapsedSeconds; }
                            errorPlaced ||= !!failedContinuation || !!waitingForHost;
                        }
                    } catch {
                        const notice = span('xb-dice-card xb-dice-notice', '这条检定记录暂时无法显示。');
                        wanted.add(notice); content.append(notice);
                    }
                }
                let mounted = mountCheckCards(content, placements);
                if (mounted.size < placements.size && (!isGenerating() || phase?.kind === 'revealing')) {
                    const sourceSignature = JSON.stringify([message.mes, projection, message.swipe_id ?? 0]);
                    if (failedSync.get(content) !== sourceSignature) {
                        // The display regex hid the former request, or native translation still projects it.
                        // No editor is present. Render a temporary view; neither mes nor display_text is assigned.
                        updateMessageBlock(index, { ...message, extra: { ...message.extra, display_text: projection } });
                        mounted = mountCheckCards(content, placements);
                        if (mounted.size < placements.size) { failedSync.set(content, sourceSignature); }
                    }
                }
                if (mounted.size === placements.size) { failedSync.delete(content); }
                for (const node of mounted) { wanted.add(node); }
                for (const id of cached.entries.keys()) { if (!kept.has(id)) { cached.entries.delete(id); } }
                if (phase && !errorPlaced) {
                    if (phase.kind === 'waiting' || phase.kind === 'settling') {
                        const pending = content.querySelector<HTMLElement>('.xb-dice-pending')
                            ?? span('xb-dice-card xb-dice-pending');
                        pending.setAttribute('role', 'status');
                        pending.setAttribute('aria-live', 'polite');
                        const label = current?.wait ? diceHostWaitLabel(current.wait)
                            : phase.kind === 'waiting' ? DICE_SESSION_COPY.waitingGroup : DICE_SESSION_COPY.waitingHost;
                        pending.dataset.diceState = 'waiting';
                        if (pending.textContent !== label) { pending.textContent = label; }
                        wanted.add(pending);
                        if (!pending.isConnected) { content.append(pending); }
                    }
                    if ('error' in phase && phase.error) {
                        const notice = span('xb-dice-card xb-dice-notice', '');
                        notice.setAttribute('role', 'status');
                        notice.append(span('xb-dice-note', phase.error));
                        if (enabled() && phase.kind === 'continue-error') {
                            notice.append(retryButton(index, DICE_SESSION_COPY.retryContinue));
                        }
                        wanted.add(notice); content.append(notice);
                    }
                }
                const paused = phase?.kind === 'wait-error';
                if (paused || !active && source?.chat.at(-1) === message && runtime.canRetryRequest(index)) {
                    const notice = content.querySelector<HTMLElement>('.xb-dice-recovery')
                        ?? span('xb-dice-card xb-dice-notice xb-dice-recovery');
                    const signature = JSON.stringify([paused, current?.wait, enabled()]);
                    if (notice.dataset.signature !== signature) {
                        notice.dataset.signature = signature;
                        notice.dataset.diceState = paused ? 'wait-error' : 'unrolled';
                        notice.setAttribute('role', 'status');
                        notice.replaceChildren(span('xb-dice-note', paused ? DICE_SESSION_COPY.paused : DICE_SESSION_COPY.unrolled));
                        if (current?.wait) { notice.append(span('xb-dice-note', diceHostWaitLabel(current.wait))); }
                        if (enabled()) { notice.append(retryButton(index, DICE_SESSION_COPY.retryCheck, 'retry-check')); }
                    }
                    wanted.add(notice);
                    if (!notice.isConnected) { content.append(notice); }
                }
                content.querySelectorAll<HTMLElement>(OWN).forEach(node => { if (!wanted.has(node)) { node.remove(); } });
            }
        } finally {
            observe();
            if (timeContinuation) { progressTimer = setTimeout(refresh, 1000); }
        }
    }
    function observe(): void {
        const chat = document.getElementById('chat');
        if (observer && chat) { observer.observe(chat, { childList: true, subtree: true, characterData: true }); }
    }
    function refresh(): void { if (observer && frame === null) { frame = requestAnimationFrame(render); } }
    return {
        refresh,
        async reveal(target: DiceTarget, candidate: DiceCandidate, signal: AbortSignal) {
            if (!observer || signal.aborted) { return; }
            if (frame !== null) { cancelAnimationFrame(frame); }
            render();
            const id = candidate.records.checks.at(-1)?.id;
            const cached = cards.get(target.message);
            const card = id && cached?.swipe === target.swipe ? cached.entries.get(id)?.view : undefined;
            if (signal.aborted) { return; }
            if (!card?.element.isConnected || !showCheckReveal(card.element)) { throw new Error('检定卡片暂时不可见。'); }
            await revealCheckCard(card, signal);
        },
        start() {
            if (observer) { return; }
            style = document.createElement('style'); style.textContent = DICE_CARD_CSS; document.head.append(style);
            observer = new MutationObserver(refresh); observe();
            const events = createModuleEvents('xiaobaiOsDiceDisplay');
            for (const name of [event_types.CHAT_CHANGED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_UPDATED, event_types.MORE_MESSAGES_LOADED]) {
                events.on(name, refresh);
            }
            disposeEvents = () => events.cleanup(); refresh();
        },
        stop() {
            observer?.disconnect(); observer = null;
            if (progressTimer !== null) { clearTimeout(progressTimer); progressTimer = null; }
            if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
            disposeEvents?.(); disposeEvents = null; style?.remove(); style = null;
            document.querySelectorAll<HTMLElement>(`#chat ${OWN}`).forEach(restoreCheckMarker);
        },
    };
}
