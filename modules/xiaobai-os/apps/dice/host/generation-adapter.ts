import { activateSendButtons, deactivateSendButtons, setCharacterId, setCharacterName, setExternalAbortController, setSendButtonState, stopGeneration, is_send_press, eventSource } from '../../../../../../../../../script.js';
import { isGenerating } from '../../../host/sillytavern-generation-state.js';
import { generateGroupWrapper, is_group_generating } from '../../../../../../../../group-chats.js';
import { uuidv4 } from '../../../../../../../../utils.js';
import { createModuleEvents, event_types } from '../../../../../core/event-manager.js';
import { registerGenerateInterceptor, unregisterGenerateInterceptor, GENERATE_INTERCEPTOR_ORDER } from '../../../../../shared/common/generate-interceptor.js';
import { setSillyTavernPrompt } from '../../../host/sillytavern-runtime-adapters.js';
import { buildActionCheckPrompt } from '../protocol/prompt.js';
import type { ActionCheckFrequency, ActionCheckRule } from '../types.js';
import { readCoc7Sheet, type Coc7Sheet } from '../domain/coc7-sheet.js';
import { parseDiceRecords } from '../domain/check-records.js';
import { createActionCheckSession } from '../application/action-check-session.js';
import type { DiceContinuationStage, DiceContinuationProgress } from '../application/host-wait.js';
import { applyDiceCandidate, captureDiceTarget, clearNewDiceSwipe, isDiceTargetCurrent, readDiceRecords, type DiceCandidate, type DiceTarget } from './message-records.js';
import { filterDiceGenerationData, type DiceGenerationData } from './request-filter.js';
import { parseActionCheck } from '../protocol/request.js';
import { captureDiceChat, diceHostContext, ensureDiceDisplayRule, isDiceMessageBeingEdited, waitForDiceHost } from './sillytavern-port.js';

const KEY = 'xiaobai_os_dice';
const MAIN_TYPES = ['', 'normal', 'regenerate', 'swipe', 'continue'];
interface Observation {
    source: NonNullable<ReturnType<typeof captureDiceChat>>;
    type: string; from: number; initialBody: string; signal?: AbortSignal;
    stage: 'preparing' | 'receiving';
    previousStream: ReturnType<typeof diceHostContext>['streamingProcessor'];
    error?: string;
    rule: ActionCheckRule;
    coc7Sheet: Coc7Sheet | null;
}

export function createDiceGenerationAdapter(enabled: () => boolean, frequency: () => ActionCheckFrequency, changed: () => void,
    reveal: (target: DiceTarget, candidate: DiceCandidate, signal: AbortSignal) => Promise<void>, rule: () => ActionCheckRule,
    sheet: () => unknown = () => null) {
    let observation: Observation | null = null;
    let intention: { target: DiceTarget; candidate: DiceCandidate; signal: AbortSignal;
        settled: Promise<void>; received: boolean; stage: DiceContinuationStage; stageStartedAt: number; error?: string } | null = null;
    let wrapperSignal: AbortSignal | undefined;
    let controls: { signal: AbortSignal; nativePending: boolean } | null = null;
    let replacement: AbortController | null = null;
    let unsubscribe: (() => void) | null = null;
    const clearPrompt = () => setSillyTavernPrompt(KEY, '');
    const currentTarget = (target: DiceTarget) => isDiceTargetCurrent(captureDiceChat(), target) && !isDiceMessageBeingEdited(target.index);
    const captureSheet = () => { const value = readCoc7Sheet(sheet()); return value.kind === 'ready' ? value.sheet : null; };
    const session = createActionCheckSession({
        enabled, current: currentTarget,
        same: (left, right) => left.message === right.message && left.swipe === right.swipe,
        ready: (target, signal, inGroup, report) => waitForDiceHost(target, signal, inGroup,
            () => controls?.signal === signal ? controls.nativePending : isGenerating(), report),
        apply: (target, candidate) => applyDiceCandidate(captureDiceChat(), target, candidate), changed,
        busy(value, signal) { setPostprocessBusy(value, signal); },
        id: uuidv4,
        reveal,
        async continue(target, candidate, signal) {
            // Explicit recovery may replace a cancelled call while its native I/O unwinds.
            // A live continuation still owns the normal chain until Generate resolves.
            if (intention && !intention.signal.aborted) { await intention.settled; }
            if (!currentTarget(target) || signal.aborted) { return null; }
            const inGroup = is_group_generating;
            const callController = new AbortController();
            const callSignal = inGroup ? wrapperSignal : callController.signal;
            if (!callSignal) { throw new Error('本次群聊已结束，无法继续检定。'); }
            let settle!: () => void;
            const settled = new Promise<void>(resolve => { settle = resolve; });
            const own: NonNullable<typeof intention> = { target, candidate, signal: callSignal, settled, received: false,
                stage: 'preparing', stageStartedAt: Date.now() };
            if (!inGroup) { setExternalAbortController(callController); }
            intention = own;
            changed();
            const previousStream = diceHostContext().streamingProcessor;
            const cancel = () => {
                if (intention !== own) { return; }
                if (inGroup) { stopGeneration(); }
                else {
                    // A replacement caller may already have installed its external controller.
                    // Cancel our request and stream, never whichever controller is now global.
                    callController.abort();
                    const stream = diceHostContext().streamingProcessor;
                    if (stream && stream !== previousStream) { stream.onStopStreaming(); }
                }
            };
            signal.addEventListener('abort', cancel, { once: true });
            try {
                // ST 1.18's nonzero recursion depth skips slash commands and all composer reads/writes.
                // 'continue' cannot call native tools, so this does not reduce a tool-call recursion budget.
                const options = {
                    signal: callSignal, depth: 1,
                    ...(target.source.groupId ? { force_chid: target.source.characterId } : {}),
                };
                try {
                    if (target.source.groupId && !is_group_generating) {
                        // Generate's outer group branch does not forward depth; the exported wrapper does.
                        await generateGroupWrapper(false, 'continue', options);
                    } else {
                        await diceHostContext().generate('continue', options);
                    }
                } catch (error) {
                    if (signal.aborted) { return null; }
                    if (own.error) { throw new Error(own.error); }
                    // Native generation owns API feedback. Keep same-roll recovery without repeating it.
                    console.error('[LittleWhiteBox] Dice host continuation failed', error);
                    return null;
                }
                if (signal.aborted || intention !== own) { return null; }
                if (own.error) { throw new Error(own.error); }
                const source = captureDiceChat();
                if (!source || source.key !== target.source.key || source.chat !== target.source.chat
                    || source.chat.at(-1) !== target.message || (target.message.swipe_id ?? 0) !== target.swipe) { return null; }
                const stream = diceHostContext().streamingProcessor;
                // Generate resolves even when its stream fails. Partial output is not a completed reply.
                if (stream && stream !== previousStream && stream.isStopped) { return null; }
                return captureDiceTarget(source, target.index, candidate.body.length, target.rule, target.coc7Sheet);
            } finally {
                signal.removeEventListener('abort', cancel);
                if (intention === own) { intention = null; clearPrompt(); }
                settle();
                changed();
            }
        },
    });

    function advanceContinuation(stage: DiceContinuationStage): void {
        if (!intention || intention.signal.aborted || intention.stage === stage) { return; }
        intention.stage = stage;
        intention.stageStartedAt = Date.now();
        changed();
    }

    function setPostprocessBusy(value: boolean, signal: AbortSignal): void {
        if (value) {
            if (signal.aborted || controls?.signal === signal) { return; }
            controls = { signal, nativePending: is_send_press };
            setSendButtonState(true);
            deactivateSendButtons();
            return;
        }
        if (controls?.signal !== signal) { return; }
        const nativePending = controls.nativePending;
        controls = null;
        // A paused Dice wait must not unlock a generation still owned by ST.
        if (nativePending) { return; }
        setSendButtonState(false);
        if (!is_group_generating) { activateSendButtons(); }
    }

    function cancel(): void {
        observation = null;
        if (replacement) {
            replacement.abort();
            setPostprocessBusy(false, replacement.signal);
        }
        session.cancel();
        clearPrompt();
    }

    async function groupBoundary(): Promise<void> {
        if (intention) { return; }
        const pending = session.view();
        if (!pending || pending.phase.kind !== 'waiting') { return; }
        const previousId = diceHostContext().characterId;
        const previousName = diceHostContext().name2;
        const source = pending.target.source;
        setCharacterId(source.characterId);
        setCharacterName(source.characterName);
        try {
            await session.drain(Boolean(is_group_generating));
            const result = session.view();
            if (result && ['wait-error', 'continue-error', 'invalid'].includes(result.phase.kind) && is_group_generating) {
                // Abort the native wrapper, not a second queue. The interceptor below blocks its next drafted call.
                stopGeneration();
            }
        } finally {
            if (captureDiceChat()?.key === source.key) {
                setCharacterId(previousId);
                setCharacterName(previousName);
            }
        }
    }

    function start(): void {
        if (unsubscribe) { return; }
        const events = createModuleEvents('xiaobaiOsDice');
        const started = async (type: unknown, options: { signal?: AbortSignal }, dryRun: unknown) => {
            if (dryRun || intention && type === 'continue' && options.signal === intention.signal
                && currentTarget(intention.target)) { return; }
            // Keep an error at the preceding member while the aborted wrapper unwinds.
            if (is_group_generating && wrapperSignal?.aborted) { return; }
            const previous = intention;
            // ST auto-swipe awaits a nested Generate after MESSAGE_SWIPED changes the target.
            // Waiting on that outer call here would make it wait on itself.
            const nativeSwipe = previous?.received && type === 'swipe'
                && captureDiceChat()?.chat === previous.target.source.chat
                && (previous.target.message.swipe_id ?? 0) !== previous.target.swipe;
            controls = null;
            cancel();
            replacement = null;
            if (nativeSwipe) { intention = null; return; }
            // Do not let the old native Generate() finalize after the replacement has taken ownership.
            // Its stop path is abortable, but the host still performs async save/UI cleanup afterward.
            if (previous) {
                const incoming = new AbortController();
                replacement = incoming;
                setPostprocessBusy(true, incoming.signal);
                await previous.settled;
                if (replacement === incoming && !incoming.signal.aborted) {
                    // Hand the controls back to the incoming native call, not the cancelled Dice run.
                    controls = null; replacement = null;
                    setSendButtonState(true); deactivateSendButtons();
                }
            }
        };
        eventSource.makeFirst(event_types.GENERATION_STARTED, started);
        const ended = () => {
            queueMicrotask(changed);
            const own = controls;
            if (!own || own.signal.aborted) { return; }
            own.nativePending = false;
            queueMicrotask(() => {
                if (controls !== own || own.signal.aborted) { return; }
                setSendButtonState(true);
                deactivateSendButtons();
            });
        };
        eventSource.makeFirst(event_types.GENERATION_ENDED, ended);
        events.on(event_types.GENERATION_AFTER_COMMANDS, (value: unknown, options: { signal?: AbortSignal }, dryRun: unknown) => {
            if (dryRun) { return; }
            const type = String(value || '');
            if (is_group_generating && options.signal) { wrapperSignal = options.signal; }
            const source = captureDiceChat();
            if (!source || source.groupId && !is_group_generating) { return; }
            const last = source.chat.at(-1);
            // Candidate ownership is independent of whether new rolls are enabled.
            if (type === 'swipe' && last) { clearNewDiceSwipe(last); }
            if (!enabled() || !MAIN_TYPES.includes(type) || intention) { return; }
            observation = { source, type, from: type === 'continue' ? last?.mes.length ?? 0 : 0,
                rule: rule(), coc7Sheet: captureSheet(),
                initialBody: type === 'continue' ? last?.mes ?? '' : '', signal: options.signal, stage: 'preparing',
                previousStream: diceHostContext().streamingProcessor };
            changed();
        });
        registerGenerateInterceptor(KEY, async (_chat: unknown, _size: unknown, abort: (immediate: boolean) => void, type: string) => {
            // Native send flags are set after AFTER_COMMANDS, before prompt assembly.
            changed();
            if (replacement?.signal.aborted) { replacement = null; clearPrompt(); abort(true); return; }
            if (is_group_generating && wrapperSignal?.aborted) { abort(true); return; }
            const own = intention;
            const observed = observation;
            const current = () => own ? intention === own && !own.signal.aborted
                && currentTarget(own.target)
                : !observed || observation === observed && !observed.signal?.aborted
                    && captureDiceChat()?.chat === observed.source.chat && captureDiceChat()?.key === observed.source.key;
            if (!current()) { abort(true); return; }
            if (!enabled() || !MAIN_TYPES.includes(String(type || ''))) { clearPrompt(); return; }
            if (observation) { observation.stage = 'receiving'; }
            try {
                await ensureDiceDisplayRule();
                // The host can yield during preparation. Stop this request before it can target another floor.
                if (!current()) { abort(true); return; }
                const last = diceHostContext().chat.at(-1);
                const saved = type === 'continue' && last ? readDiceRecords(last) : undefined;
                const records = own?.candidate.records.checks ?? (saved === undefined ? [] : parseDiceRecords(saved).checks);
                if (!enabled()) { clearPrompt(); return; }
                const activeRule = own?.target.rule ?? observed?.rule ?? rule();
                const activeSheet = own ? own.target.coc7Sheet : observed ? observed.coc7Sheet : captureSheet();
                setSillyTavernPrompt(KEY, buildActionCheckPrompt(last?.mes ?? '', records, frequency(), activeRule, !!activeSheet));
            } catch (error) {
                console.error('[LittleWhiteBox] Dice check preparation failed', error);
                if (!current()) { abort(true); return; }
                clearPrompt();
                if (own) {
                    own.error = '暂时无法继续行动检定。';
                    abort(true);
                } else if (observed) {
                    observed.error = '本次未能进行行动检定。';
                }
            }
        }, GENERATE_INTERCEPTOR_ORDER.XIAOBAI_OS_DICE);
        events.on(event_types.GENERATE_AFTER_DATA, (data: DiceGenerationData, dryRun: unknown) => {
            // Saved markers remain display-only even when new checks are disabled; previews use the same projection.
            filterDiceGenerationData(data);
            if (!dryRun) { clearPrompt(); advanceContinuation('requesting'); }
        });
        events.on(event_types.STREAM_TOKEN_RECEIVED, () => advanceContinuation('responding'));
        const received = (index: number, type: string) => {
            if (intention && index === intention.target.index) { intention.received = true; }
            if (intention || observation?.stage !== 'receiving' || !MAIN_TYPES.includes(type) && type !== 'appendFinal') { return; }
            const observed = observation;
            observation = null;
            changed();
            const stream = diceHostContext().streamingProcessor;
            // ST also emits MESSAGE_RECEIVED on a failed normal stream. Ignore only that call's
            // processor, not a stale failure left behind before a subsequent non-streaming reply.
            if (stream && stream !== observed.previousStream && stream.isStopped) { return; }
            const source = captureDiceChat();
            if (!source || source.key !== observed.source.key || source.chat !== observed.source.chat || observed.signal?.aborted) { return; }
            const target = captureDiceTarget(source, index, observed.from, observed.rule, observed.coc7Sheet);
            if (!target || !target.body.startsWith(observed.initialBody)) { return; }
            session.accept(target, observed.error);
            if (!source.groupId) { void session.drain().catch(error => console.error('[LittleWhiteBox] Dice check failed', error)); }
        };
        eventSource.makeFirst(event_types.MESSAGE_RECEIVED, received);
        events.on(event_types.GROUP_MEMBER_DRAFTED, groupBoundary);
        events.on(event_types.GROUP_WRAPPER_FINISHED, async () => { await groupBoundary(); wrapperSignal = undefined; changed(); });
        const stopped = () => {
            const phase = session.view()?.phase.kind;
            // Internal wrapper stop must not discard the same-roll recovery candidate.
            if (controls || !['wait-error', 'continue-error', 'invalid'].includes(phase ?? '')) { cancel(); }
            clearPrompt();
        };
        eventSource.makeFirst(event_types.GENERATION_STOPPED, stopped);
        events.on(event_types.MESSAGE_DELETED, () => {
            // ST removes the old reply once between AFTER_COMMANDS and the interceptors on regenerate.
            // Consume that preparation step only; a deletion during reception still cancels the request.
            if (observation?.type === 'regenerate' && observation.stage === 'preparing') {
                observation.stage = 'receiving';
                return;
            }
            cancel();
        });
        for (const name of [event_types.CHAT_CHANGED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_EDITED]) {
            events.on(name, cancel);
        }
        unsubscribe = () => {
            eventSource.removeListener(event_types.MESSAGE_RECEIVED, received);
            eventSource.removeListener(event_types.GENERATION_ENDED, ended);
            eventSource.removeListener(event_types.GENERATION_STARTED, started);
            eventSource.removeListener(event_types.GENERATION_STOPPED, stopped);
            events.cleanup(); unregisterGenerateInterceptor(KEY);
        };
    }

    function stop(): void {
        cancel(); unsubscribe?.(); unsubscribe = null; wrapperSignal = undefined;
    }
    return { start, stop, cancel,
        view() {
            const current = session.view();
            if (!current) { return null; }
            const own = intention;
            const continuation: DiceContinuationProgress | null = current.phase.kind === 'continuing'
                && own && !own.signal.aborted && !own.received && own.candidate === current.phase.candidate
                ? { stage: own.stage, elapsedSeconds: Math.floor((Date.now() - own.stageStartedAt) / 1000) } : null;
            return { ...current, continuation };
        },
        isBusy: () => isGenerating() || !!controls || !!intention,
        canRetryRequest(index: number): boolean {
            if (!enabled() || session.view() || isGenerating() || observation || intention || isDiceMessageBeingEdited(index)) { return false; }
            const source = captureDiceChat();
            if (!source || index !== source.chat.length - 1) { return false; }
            const target = captureDiceTarget(source, index, 0, rule());
            return !!target && parseActionCheck(target.body, 0, target.rule).kind === 'request';
        },
        async retry(index: number) {
            if (isGenerating()) { throw new Error('请等待酒馆生成结束。'); }
            const source = captureDiceChat();
            const pending = session.view();
            const retained = pending && ['wait-error', 'continue-error'].includes(pending.phase.kind)
                && pending.target.index === index && currentTarget(pending.target)
                ? pending.target : null;
            const target = retained ?? (source && captureDiceTarget(source, index, 0, rule(), captureSheet()));
            if (!target) { throw new Error('回复已不存在。'); }
            await session.retry(target);
        },
    };
}
