import { updateMessageBlock } from '../../../../../../../../../script.js';
import { isGenerating } from '../../../../../shared/common/sillytavern-generation-state.js';
import { createModuleEvents, event_types } from '../../../../../core/event-manager.js';
import { isCheckContinuationPoint, referencedActionChecks } from '../domain/check-records.js';
import { createCheckCard, type CheckCard } from '../ui/check-card.js';
import { diceSpan as span } from '../ui/card-elements.js';
import { revealCheckCard } from '../ui/reveal.js';
import { readDiceRecords, type DiceCandidate, type DiceHostMessage, type DiceTarget } from './message-records.js';
import { captureDiceChat } from './sillytavern-port.js';
import type { createDiceGenerationAdapter, DiceCardAction, DiceCardActions } from './generation-adapter.js';
import { DICE_CARD_CSS } from './card-style.js';
import { mountCheckCards, restoreCheckMarker } from './check-marker-dom.js';
import { checkDisplayProjection } from './check-display-projection.js';
import { showCheckReveal } from './reveal-visibility.js';
import { DICE_SESSION_COPY, diceHostWaitLabel, diceContinuationLabel } from '../ui/session-copy.js';

type Runtime = ReturnType<typeof createDiceGenerationAdapter>;
const OWN = '.xb-dice-card';
interface CardEntry { signature: string; identity: string; view: CheckCard; status: string; revealId?: string; error?: string; restoreFocus?: HTMLButtonElement }

export function createDiceMessageDisplay(runtime: Runtime, enabled: () => boolean) {
    let observer: MutationObserver | null = null;
    let disposeEvents: (() => void) | null = null;
    let flushRefresh: (() => void) | null = null;
    let progressTimer: ReturnType<typeof setTimeout> | null = null;
    let style: HTMLStyleElement | null = null;
    // Message/candidate identity, not the host's replaceable formatted DOM, owns a mounted card.
    const cards = new WeakMap<DiceHostMessage, { swipe: number; entries: Map<string, CardEntry> }>();
    // Don't repeatedly repaint a source whose markers are suppressed by host formatting.
    const failedSync = new WeakMap<HTMLElement, string>();

    function retryButton(index: number, label: string, action: DiceCardAction = 'continue-check'): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.dataset.diceAction = action;
        const available = runtime.actions(index);
        button.addEventListener('click', () => {
            button.disabled = true;
            if (!available) { button.disabled = false; return; }
            void runtime.act(available.target, action).catch(error => {
                console.error('[LittleWhiteBox] Dice retry failed', error);
                const note = span('xb-dice-note', DICE_SESSION_COPY.retryFailed);
                note.setAttribute('role', 'alert'); button.after(note);
            }).finally(() => { button.disabled = false; refresh(); });
        });
        return button;
    }

    function setStatus(entry: CardEntry, error: string, actions: DiceCardActions | null): void {
        const signature = JSON.stringify([actions?.kind, actions?.canReroll]);
        const status = entry.view.status;
        if (entry.status !== signature) {
            entry.status = signature;
            status.replaceChildren(span('xb-dice-note'));
            const items: [DiceCardAction, string][] = actions?.kind === 'choice'
                ? [['continue-check', DICE_SESSION_COPY.retryContinue], ...(actions.canReroll ? [['reroll-check', DICE_SESSION_COPY.reroll] as [DiceCardAction, string]] : [])]
                : [];
            for (const [action, label] of items) {
                const button = document.createElement('button');
                button.type = 'button'; button.textContent = label; button.dataset.diceAction = action;
                if (action === 'reroll-check') {
                    button.append(span('xb-dice-price', DICE_SESSION_COPY.price));
                    button.setAttribute('aria-label', DICE_SESSION_COPY.rerollAccessible);
                }
                status.append(button);
            }
        }
        const note = status.querySelector<HTMLElement>('.xb-dice-note')!;
        note.textContent = error || entry.error || (actions?.insufficientFunds ? DICE_SESSION_COPY.insufficientFunds : '');
        note.hidden = !note.textContent;
        status.hidden = !note.textContent && !actions;
        for (const button of status.querySelectorAll<HTMLButtonElement>('button')) {
            if (button.dataset.diceAction === 'continue-check' || button.dataset.diceAction === 'cancel-continue') {
                button.dataset.diceAction = actions?.canCancel ? 'cancel-continue' : 'continue-check';
                button.textContent = actions?.canCancel ? DICE_SESSION_COPY.cancelContinue : DICE_SESSION_COPY.retryContinue;
            }
            button.disabled = button.dataset.diceAction === 'cancel-continue' ? !actions?.canCancel
                : !actions || actions.disabled || button.dataset.diceAction === 'reroll-check' && !!actions.rerollDisabled;
            button.onclick = () => {
                if (!actions || button.disabled) { return; }
                entry.error = undefined;
                if (document.activeElement === button) { entry.restoreFocus = button; }
                status.querySelectorAll<HTMLButtonElement>('button').forEach(item => { item.disabled = true; });
                void runtime.act(actions.target, button.dataset.diceAction as DiceCardAction).catch(cause => {
                    entry.error = cause instanceof Error ? cause.message : DICE_SESSION_COPY.retryFailed;
                }).finally(refresh);
            };
        }
    }

    function render(roots: Iterable<HTMLElement>): void {
        let timeContinuation = false;
        let updateProgressTimer = false;
        observer?.disconnect();
        try {
            const source = captureDiceChat();
            const active = runtime.view();
            updateProgressTimer = !active;
            // The host owns stream following. Its temporary marker-only layout cannot
            // tell us whether the reader left the bottom; only reveal() positions a new die.
            for (const root of roots) {
                if (!root.isConnected || !root.matches('#chat .mes')) { continue; }
                const index = Number(root.getAttribute('mesid'));
                const message = source?.chat[index];
                const content = root.querySelector<HTMLElement>('.mes_text');
                if (!content) { continue; }
                const value = message && readDiceRecords(message);
                const current = active && active.target.message === message && active.target.swipe === (message?.swipe_id ?? 0) ? active : null;
                updateProgressTimer ||= !!current;
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
                let unreadable = false;
                let projection = message.mes;
                if (value !== undefined) {
                    try {
                        const records = runtime.records(message)!;
                        projection = checkDisplayProjection(message, records.checks);
                        const referenced = referencedActionChecks(message.mes, records.checks);
                        for (const record of referenced) {
                            const pending = phase?.kind === 'revealing'
                                && continuing?.id === record.id;
                            const signature = JSON.stringify(record);
                            const identity = JSON.stringify([record.rule, record.request]);
                            const revealId = pending && phase?.kind === 'revealing' ? phase.revealId : undefined;
                            let entry = cached.entries.get(record.id);
                            if (!entry || entry.identity !== identity) {
                                entry = { signature, identity, view: createCheckCard(record, !!pending), status: '', revealId };
                                cached.entries.set(record.id, entry);
                            } else if (entry.signature !== signature || revealId && entry.revealId !== revealId) {
                                entry.view.update(record, !!pending);
                                entry.signature = signature; entry.revealId = revealId; entry.error = undefined;
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
                            const actions = record === referenced.at(-1) ? runtime.actions(index) : null;
                            setStatus(entry, error, actions);
                            if (waitingForText || waitingForHost) {
                                view.status.dataset.diceState = waitingForHost ? 'waiting' : progress?.stage ?? 'preparing';
                            } else { delete view.status.dataset.diceState; }
                            if (progress) { view.status.dataset.elapsedSeconds = String(progress.elapsedSeconds); }
                            else { delete view.status.dataset.elapsedSeconds; }
                            errorPlaced ||= !!failedContinuation || !!waitingForHost;
                        }
                    } catch {
                        unreadable = true;
                        const notice = span('xb-dice-card xb-dice-notice', DICE_SESSION_COPY.unavailable);
                        notice.setAttribute('role', 'alert');
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
                for (const entry of cached.entries.values()) {
                    const focus = entry.restoreFocus;
                    if (!focus || focus.isConnected && focus.disabled) { continue; }
                    entry.restoreFocus = undefined;
                    // Button readiness, not optional payment completion, returns keyboard focus.
                    if (focus.isConnected && (document.activeElement === document.body || document.activeElement === focus)) {
                        focus.focus({ preventScroll: true });
                    }
                }
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
                if (!unreadable && !active && source?.chat.at(-1) === message && runtime.canRetryRequest(index)) {
                    const notice = content.querySelector<HTMLElement>('.xb-dice-recovery')
                        ?? span('xb-dice-card xb-dice-notice xb-dice-recovery');
                    const signature = JSON.stringify([enabled()]);
                    if (notice.dataset.signature !== signature) {
                        notice.dataset.signature = signature;
                        notice.dataset.diceState = 'unrolled';
                        notice.setAttribute('role', 'status');
                        notice.replaceChildren(span('xb-dice-note', DICE_SESSION_COPY.unrolled));
                        if (enabled()) { notice.append(retryButton(index, DICE_SESSION_COPY.retryCheck, 'retry-check')); }
                    }
                    wanted.add(notice);
                    if (!notice.isConnected) { content.append(notice); }
                }
                content.querySelectorAll<HTMLElement>(OWN).forEach(node => { if (!wanted.has(node)) { node.remove(); } });
            }
        } finally {
            observe();
            // An unrelated floor's repaint must not stop the active check's clock.
            if (updateProgressTimer) {
                if (progressTimer !== null) { clearTimeout(progressTimer); progressTimer = null; }
                if (timeContinuation) { progressTimer = setTimeout(refresh, 1000); }
            }
        }
    }
    function observe(): void {
        const chat = document.getElementById('chat');
        if (observer && chat) { observer.observe(chat, { childList: true, subtree: true, characterData: true }); }
    }
    function refresh(): void {
        if (!observer || flushRefresh) { return; }
        const flush = () => {
            if (flushRefresh !== flush) { return; }
            flushRefresh = null;
            render(document.querySelectorAll<HTMLElement>('#chat .mes'));
        };
        flushRefresh = flush;
        queueMicrotask(flush);
    }
    function repaintChangedMessages(mutations: MutationRecord[]): void {
        const roots = new Set<HTMLElement>();
        for (const mutation of mutations) {
            const element = mutation.target.nodeType === 1 ? mutation.target as Element : mutation.target.parentElement;
            // Card-owned changes (including dice animation) are not host repaints.
            if (element?.closest(OWN)) { continue; }
            const root = element?.closest<HTMLElement>('#chat .mes');
            if (root) { roots.add(root); continue; }
            if ([...mutation.addedNodes, ...mutation.removedNodes].some(node => node.nodeType === 1
                && ((node as Element).matches('.mes') || (node as Element).querySelector('.mes')))) {
                // Membership/order changes can also change the previous last floor's actions.
                refresh(); break;
            }
        }
        // MutationObserver runs before the host's animation-frame scroll/measurement.
        // Deferring this work to rAF lets ST/TT measure the marker-only intermediate DOM.
        if (flushRefresh) { flushRefresh(); }
        else if (roots.size) { render(roots); }
    }
    return {
        refresh,
        async reveal(target: DiceTarget, candidate: DiceCandidate, signal: AbortSignal) {
            if (!observer || signal.aborted) { return; }
            // Non-streaming MESSAGE_RECEIVED precedes addOneMessage in ST and TT.
            // Calculation is already applied; only the optional animation waits for DOM.
            if (!document.querySelector(`#chat .mes[mesid="${target.index}"]`)) {
                await new Promise<void>(resolve => {
                    const events = createModuleEvents('xiaobaiOsDiceReveal');
                    const done = () => { events.cleanup(); signal.removeEventListener('abort', done); resolve(); };
                    events.on(event_types.CHARACTER_MESSAGE_RENDERED, (index: number) => { if (index === target.index) { done(); } });
                    signal.addEventListener('abort', done, { once: true });
                });
            }
            if (!observer || signal.aborted) { return; }
            flushRefresh = null;
            render(document.querySelectorAll<HTMLElement>('#chat .mes'));
            const id = referencedActionChecks(candidate.body, candidate.records.checks).at(-1)?.id;
            const cached = cards.get(target.message);
            const card = id && cached?.swipe === target.swipe ? cached.entries.get(id)?.view : undefined;
            if (signal.aborted) { return; }
            const phase = runtime.view()?.phase;
            const replacing = phase?.kind === 'revealing' && phase.placement === 'replace';
            if (!card?.element.isConnected || !replacing && !showCheckReveal(card.element)) { throw new Error('检定卡片暂时不可见。'); }
            await revealCheckCard(card, signal);
        },
        start() {
            if (observer) { return; }
            style = document.createElement('style'); style.textContent = DICE_CARD_CSS; document.head.append(style);
            observer = new MutationObserver(repaintChangedMessages); observe();
            const events = createModuleEvents('xiaobaiOsDiceDisplay');
            for (const name of [event_types.CHAT_CHANGED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_UPDATED, event_types.MORE_MESSAGES_LOADED]) {
                events.on(name, refresh);
            }
            disposeEvents = () => events.cleanup(); refresh();
        },
        stop() {
            observer?.disconnect(); observer = null;
            if (progressTimer !== null) { clearTimeout(progressTimer); progressTimer = null; }
            flushRefresh = null;
            disposeEvents?.(); disposeEvents = null; style?.remove(); style = null;
            document.querySelectorAll<HTMLElement>(`#chat ${OWN}`).forEach(restoreCheckMarker);
        },
    };
}
