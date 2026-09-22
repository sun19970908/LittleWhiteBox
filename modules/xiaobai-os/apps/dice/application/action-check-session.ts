import { prepareActionCheck } from './prepare-action-check.js';
import { MAX_ACTION_CHECKS, referencedActionChecks, isCheckContinuationPoint, parseDiceRecords, type DiceMessageRecords } from '../domain/check-records.js';
import { parseActionCheck } from '../protocol/request.js';
import type { ActionCheckRule } from '../types.js';
import { COC7_SHEET_ERRORS, type Coc7Sheet } from '../domain/coc7-sheet.js';
import { DiceHostWaitTimeout, type DiceHostWait } from './host-wait.js';

export interface ActionCheckTarget { body: string; records: unknown; generatedFrom: number; rule: ActionCheckRule; coc7Sheet?: Coc7Sheet | null }
export interface DiceCandidate { body: string; records: DiceMessageRecords }

type Phase = { kind: 'waiting' | 'wait-error' }
    | { kind: 'settling'; candidate?: DiceCandidate }
    | { kind: 'revealing' | 'continuing'; candidate: DiceCandidate }
    | { kind: 'continue-error'; candidate: DiceCandidate; error: string }
    | { kind: 'invalid'; error: string };
interface Run<T> { controller: AbortController; target: T; phase: Phase; wait: DiceHostWait | null }
export interface DiceSessionPort<T extends ActionCheckTarget> {
    enabled(): boolean;
    current(target: T): boolean;
    same(left: T, right: T): boolean;
    ready(target: T, signal: AbortSignal, inGroup: boolean, report: (wait: DiceHostWait) => void): Promise<void>;
    apply(target: T, candidate: DiceCandidate): void;
    reveal(target: T, candidate: DiceCandidate, signal: AbortSignal): Promise<void>;
    /** Null means the host did not complete the continuation; its own UI owns provider errors. */
    continue(target: T, candidate: DiceCandidate, signal: AbortSignal): Promise<T | null>;
    busy?(busy: boolean, signal: AbortSignal): void;
    changed(): void;
    random?: () => number;
    id(): string;
}

const errors: Record<string, string> = {
    dice_check_limit: `本条回复已检定 ${MAX_ACTION_CHECKS} 次，不再继续掷骰。`,
    [COC7_SHEET_ERRORS.missing]: '请先在 Dice 中分配并保存人物能力，未掷骰。',
    [COC7_SHEET_ERRORS.invalid]: '人物能力分配无效，未掷骰。请在 Dice 中重新分配或重置。',
};
const invalidRequest = '这次检定信息不完整或格式无效，未掷骰。';

/** One ephemeral chain. Only an explicit retry may resume an unrolled request; saved results never reroll. */
export function createActionCheckSession<T extends ActionCheckTarget>(port: DiceSessionPort<T>) {
    let run: Run<T> | null = null;
    const owns = (current: Run<T>) => run === current && !current.controller.signal.aborted && port.enabled();
    const publish = () => port.changed();

    function cancel(): void {
        const previous = run;
        run = null;
        previous?.controller.abort();
        if (previous) { port.busy?.(false, previous.controller.signal); }
        publish();
    }

    function pendingPhase(target: T, preparationError = ''): Phase | null {
        const parsed = parseActionCheck(target.body, target.generatedFrom, target.rule);
        if (parsed.kind === 'none') { return null; }
        if (preparationError) { return { kind: 'invalid', error: preparationError }; }
        return parsed.kind === 'request' ? { kind: 'waiting' }
            : { kind: 'invalid', error: errors[parsed.error] ?? invalidRequest };
    }

    function accept(target: T, preparationError = ''): void {
        cancel();
        if (!port.enabled() || !port.current(target)) { return; }
        const phase = pendingPhase(target, preparationError);
        if (!phase) { return; }
        run = { controller: new AbortController(), target, phase, wait: null };
        if (phase.kind === 'waiting') { port.busy?.(true, run.controller.signal); }
        publish();
    }

    async function execute(current: Run<T>, inGroup: boolean): Promise<void> {
        try {
            port.busy?.(true, current.controller.signal);
            while (owns(current)) {
                const retained = current.phase.kind === 'continue-error' ? current.phase.candidate : undefined;
                current.phase = { kind: 'settling', candidate: retained };
                current.wait = null;
                publish();
                await port.ready(current.target, current.controller.signal, inGroup, wait => {
                    if (!owns(current)) { return; }
                    current.wait = wait;
                    publish();
                });
                if (!owns(current)) { return; }
                if (!port.current(current.target)) { cancel(); return; }
                current.wait = null;
                let candidate: DiceCandidate;
                if (retained) { candidate = retained; }
                else {
                    const prepared = prepareActionCheck({ body: current.target.body, records: current.target.records,
                        generatedFrom: current.target.generatedFrom, rule: current.target.rule, coc7Sheet: current.target.coc7Sheet, id: port.id(), random: port.random });
                    if (prepared.kind === 'none') { run = null; return; }
                    if (prepared.kind === 'invalid') {
                        current.phase = { kind: 'invalid', error: errors[prepared.error] ?? invalidRequest };
                        return;
                    }
                    candidate = prepared;
                }
                if (!retained) {
                    port.apply(current.target, candidate);
                    current.target = { ...current.target, body: candidate.body, records: candidate.records };
                }
                if (!port.current(current.target)) { cancel(); return; }
                if (!retained) {
                    current.phase = { kind: 'revealing', candidate };
                    publish();
                    await port.reveal(current.target, candidate, current.controller.signal);
                    if (!owns(current)) { return; }
                    if (!port.current(current.target)) { cancel(); return; }
                }
                current.phase = { kind: 'continuing', candidate };
                publish();
                const next = await port.continue(current.target, candidate, current.controller.signal);
                if (!owns(current)) { return; }
                if (!next || !next.body.startsWith(candidate.body) || !next.body.slice(candidate.body.length).trim()) {
                    current.phase = port.current(current.target)
                        ? { kind: 'continue-error', candidate, error: '' }
                        : { kind: 'invalid', error: '' };
                    return;
                }
                current.target = next;
                const nextPhase = pendingPhase(next);
                if (!nextPhase) { run = null; return; }
                current.phase = nextPhase;
                if (nextPhase.kind === 'invalid') { return; }
            }
        } catch (error) {
            if (!owns(current)) { return; }
            const phase = current.phase;
            console.error('[LittleWhiteBox] Dice check failed', error);
            if (error instanceof DiceHostWaitTimeout) { current.wait = error.wait; }
            if (phase.kind === 'continuing' || phase.kind === 'revealing') {
                current.phase = port.current(current.target)
                    ? { kind: 'continue-error', candidate: phase.candidate, error: '骰点已保留，暂时无法自动续写。' }
                    : { kind: 'invalid', error: '回复已有变化，请用酒馆的「继续」接着写。' };
            } else if (!port.current(current.target)) { cancel(); }
            else if (phase.kind === 'settling' && phase.candidate) {
                // A failed readiness wait does not invalidate the retained roll or its retry route.
                current.phase = { kind: 'continue-error', candidate: phase.candidate, error: '暂时无法继续检定，请稍后重试。' };
            } else if (error instanceof DiceHostWaitTimeout) {
                current.phase = { kind: 'wait-error' };
            } else { current.phase = { kind: 'invalid', error: '本次未完成行动检定。' }; }
        } finally {
            port.busy?.(false, current.controller.signal);
            publish();
        }
    }

    function drain(inGroup = false): Promise<void> {
        const current = run;
        if (!current || current.phase.kind !== 'waiting') { return Promise.resolve(); }
        // Consume once, including repeated MESSAGE_RECEIVED or wrapper-finished events.
        current.phase = { kind: 'settling' };
        return execute(current, inGroup);
    }

    async function retry(target: T): Promise<void> {
        if (!port.enabled()) { throw new Error('请先开启行动检定。'); }
        const current = run;
        if (current && port.same(current.target, target)
            && (current.phase.kind === 'continue-error' || current.phase.kind === 'wait-error')) {
            if (!port.current(current.target)) { cancel(); throw new Error('原回复已变更。'); }
            const replacement: Run<T> = { ...current, controller: new AbortController() };
            run = replacement;
            await execute(replacement, false);
            return;
        }
        if (current && ['revealing', 'continuing', 'waiting', 'settling'].includes(current.phase.kind)) { return; }
        // An unrolled request is itself the recovery source, including after a reload.
        // Merely displaying it never rolls; the user must explicitly choose retry.
        if (!current && parseActionCheck(target.body, target.generatedFrom, target.rule).kind === 'request') {
            accept(target);
            await drain();
            return;
        }
        const records = parseDiceRecords(target.records);
        const last = referencedActionChecks(target.body, records.checks).at(-1);
        if (!last || !isCheckContinuationPoint(target.body, last)) {
            throw new Error('回复已有变化，请用酒馆的「继续」接着写。');
        }
        cancel();
        const restored: Run<T> = { controller: new AbortController(), target,
            phase: { kind: 'continue-error', candidate: { body: target.body, records }, error: '' }, wait: null };
        run = restored;
        await execute(restored, false);
    }

    return { accept, drain, cancel, retry, view: () => run ? { target: run.target, phase: run.phase, wait: run.wait } : null };
}
