import type { EconomyTransactionCapability } from '../../../capabilities/economy/index.js';
import { completeTask, failTask, progressTask } from '../../../domains/tasks/commands/maintenance.js';
import type { TaskCommandResult, TaskDomainV1 } from '../../../domains/tasks/types.js';
import { postTaskEconomyEvent } from './economy-protocol.js';
import { taskEnvironment } from './local-actions.js';
import type {
    CommitGuard,
    MaintenanceCommitRequest,
    TaskApplicationContext,
    TaskMaintenanceCommand,
} from './service.js';

function applyCommand(
    context: TaskApplicationContext,
    domain: TaskDomainV1,
    command: TaskMaintenanceCommand,
    observedAssistantCount: number,
): TaskCommandResult {
    const common = {
        actionId: command.actionId,
        taskId: command.taskId,
        expectedTaskRevision: command.expectedTaskRevision,
        expectedEventId: command.expectedEventId,
        observedAssistantCount,
    };
    const environment = taskEnvironment(context, domain);
    if (command.kind === 'progress') {
        return progressTask(domain, { ...common, progressSummary: command.progressSummary }, environment);
    }
    if (command.kind === 'complete') {
        return completeTask(domain, { ...common, resultSummary: command.resultSummary }, environment);
    }
    return failTask(domain, { ...common, resultSummary: command.resultSummary }, environment);
}

export function createTaskMaintenanceCommit(context: TaskApplicationContext) {
    return async function commitMaintenance(input: MaintenanceCommitRequest, guard: CommitGuard) {
        if (!Array.isArray(input.commands) || input.commands.length === 0) {
            throw new TypeError('task maintenance commit requires staged commands');
        }
        if (new Set(input.commands.map(command => command.taskId)).size !== input.commands.length) {
            throw new TypeError('task maintenance commit contains duplicate tasks');
        }
        return context.execute(guard, (initialDomain, economy: EconomyTransactionCapability) => {
            const initialRevision = initialDomain.revision;
            let domain = initialDomain;
            let changed = false;
            let lastRecord: TaskCommandResult['record'] | undefined;
            for (const staged of input.commands) {
                const command = applyCommand(context, domain, staged, input.observedAssistantCount);
                domain = command.domain;
                lastRecord = command.record;
                changed ||= command.changed;
                if (command.changed && command.event) {
                    postTaskEconomyEvent(economy, command.event, command.record);
                }
            }
            domain = { ...domain, revision: initialRevision + (changed ? 1 : 0) };
            return {
                domain,
                changed,
                ...(lastRecord ? { record: lastRecord } : {}),
            };
        });
    };
}
