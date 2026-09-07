import {
    collectTaskIdentityIds,
    normalizeTaskActionId,
    normalizeTaskCandidates,
} from '../../../domains/tasks/invariants.js';
import { acceptTaskListing, publishTask, replaceTaskBoard } from '../../../domains/tasks/commands/create.js';
import { assignTaskCandidate, cancelTask, replaceTaskCandidates } from '../../../domains/tasks/commands/recruitment.js';
import type {
    TaskCandidate,
    TaskCandidateDraft,
    TaskCommandResult,
    TaskDomainV1,
} from '../../../domains/tasks/types.js';
import type { EconomyTransactionCapability } from '../../../capabilities/economy/index.js';
import { postTaskEconomyEvent } from './economy-protocol.js';
import type {
    AcceptListingRequest,
    AssignCandidateRequest,
    CancelTaskRequest,
    CommitGuard,
    PublishRequest,
    ReplaceBoardRequest,
    ReplaceCandidatesRequest,
    TaskApplicationContext,
} from './service.js';

export function taskEnvironment(context: TaskApplicationContext, domain: TaskDomainV1) {
    const occupied = collectTaskIdentityIds(domain);
    return {
        now: context.now,
        createId: () => context.ids.create('event', occupied),
    };
}

function normalizeCandidateDrafts(
    drafts: readonly TaskCandidateDraft[],
    createCandidateId: (index: number) => string,
): TaskCandidate[] {
    if (!Array.isArray(drafts)) { return normalizeTaskCandidates(drafts); }
    return normalizeTaskCandidates(drafts.map((draft, index) => ({
        ...structuredClone(draft),
        candidateId: createCandidateId(index),
    })));
}

function commitCommand(
    economy: EconomyTransactionCapability,
    command: TaskCommandResult,
) {
    if (command.changed && command.event) {
        postTaskEconomyEvent(economy, command.event, command.record);
    }
    return {
        domain: command.domain,
        changed: command.changed,
        record: command.record,
    };
}

export function createTaskLocalActions(context: TaskApplicationContext) {
    function acceptListing(input: AcceptListingRequest, guard: CommitGuard) {
        return context.execute(guard, (domain, economy) => {
            const actionId = normalizeTaskActionId(input.actionId);
            const existing = domain.events.find(event => event.actionId === actionId);
            const occupied = collectTaskIdentityIds(domain);
            occupied.add(actionId);
            const taskId = existing?.taskId ?? context.ids.create('task', occupied);
            return commitCommand(economy, acceptTaskListing(domain, {
                actionId,
                taskId,
                boardId: input.boardId,
                listingId: input.listingId,
                playerDisplayName: context.getPlayerDisplayName(),
                observedAssistantCount: context.getObservedAssistantCount(),
            }, taskEnvironment(context, domain)));
        });
    }

    function publish(input: PublishRequest, guard: CommitGuard) {
        return context.execute(guard, (domain, economy) => {
            const actionId = normalizeTaskActionId(input.actionId);
            const existing = domain.events.find(event => event.actionId === actionId);
            const occupied = collectTaskIdentityIds(domain);
            occupied.add(actionId);
            const taskId = existing?.taskId ?? context.ids.create('task', occupied);
            return commitCommand(economy, publishTask(domain, {
                actionId,
                taskId,
                form: input.form,
                playerDisplayName: context.getPlayerDisplayName(),
                observedAssistantCount: context.getObservedAssistantCount(),
            }, taskEnvironment(context, domain)));
        });
    }

    function replaceBoard(input: ReplaceBoardRequest, guard: CommitGuard) {
        return context.execute(guard, (domain) => {
            const occupied = collectTaskIdentityIds(domain);
            const boardId = context.ids.create('board', occupied);
            const listings = input.listings.map(draft => ({
                ...structuredClone(draft),
                listingId: context.ids.create('listing', occupied),
            }));
            const replaced = replaceTaskBoard(domain, {
                expectedBoardId: input.expectedBoardId,
                boardId,
                listings,
                generatedAt: input.generatedAt,
            });
            return { domain: replaced.domain, changed: true };
        });
    }

    function replaceCandidates(input: ReplaceCandidatesRequest, guard: CommitGuard) {
        return context.execute(guard, (domain, economy) => {
            const actionId = normalizeTaskActionId(input.actionId);
            const existing = domain.events.find(event => event.actionId === actionId);
            let candidates: TaskCandidate[];
            if (existing?.kind === 'candidates-replaced') {
                candidates = normalizeCandidateDrafts(input.candidates, index => (
                    existing.candidates[index]?.candidateId ?? `task-candidate-replay-${index}`
                ));
            } else {
                const occupied = collectTaskIdentityIds(domain);
                occupied.add(actionId);
                candidates = normalizeCandidateDrafts(input.candidates, () => context.ids.create('candidate', occupied));
            }
            return commitCommand(economy, replaceTaskCandidates(domain, { ...input, actionId, candidates },
                taskEnvironment(context, domain)));
        });
    }

    function assignCandidate(input: AssignCandidateRequest, guard: CommitGuard) {
        return context.execute(guard, (domain, economy) => commitCommand(economy, assignTaskCandidate(domain, {
            ...input,
            observedAssistantCount: context.getObservedAssistantCount(),
        }, taskEnvironment(context, domain))));
    }

    function cancel(input: CancelTaskRequest, guard: CommitGuard) {
        return context.execute(guard, (domain, economy) => commitCommand(economy, cancelTask(domain, {
            ...input,
            observedAssistantCount: context.getObservedAssistantCount(),
        }, taskEnvironment(context, domain))));
    }

    return Object.freeze({ acceptListing, publish, replaceBoard, replaceCandidates, assignCandidate, cancel });
}
