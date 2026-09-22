import type { ManagementParticipant, ManagementTool } from '../../../capabilities/management/index.js';
import type { TasksService } from '../application/service.js';
import { compileTaskMaintenanceCommand } from '../tools/command-compiler.js';
import { taskTools } from '../tools/tool-contract.js';
import { TASK_OBJECTIVE_POLICY } from '../tools/objective-policy.js';
import { createManagementSave } from '../../../capabilities/management/save.js';

export function createTasksManagement(tasks: TasksService, observedCount: () => number): ManagementParticipant {
    return {
        id: 'tasks', label: '任务', confirmPending: tasks.confirmPending,
        async open() {
            await tasks.refreshCurrent();
            let records = tasks.readCurrent().records;
            const saving = createManagementSave(tasks.confirmPending);
            const project = () => records.map(r => ({ taskId: r.taskId, revision: r.taskRevision, title: r.title,
                objective: r.objective, status: r.status, progressSummary: r.progressSummary, resultSummary: r.resultSummary, reward: r.reward,
                source: r.source, issuer: r.issuer.displayName, assignee: r.assignee?.displayName ?? null }));
            const read: ManagementTool = { effect: 'read', label: '查看任务', target: a => String(a.taskId ?? ''),
                definition: { type: 'function', function: { name: 'TasksRead',
                    description: 'Read current task records, including objective, status, progress and reward. data contains {items,total,nextOffset}; taskId selects one task. Default 20 records, maximum 50.',
                    parameters: { type: 'object', properties: { taskId: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false } } } };
            const labels: Record<string, string> = { TaskProgress: '修正任务进展', TaskComplete: '完成任务', TaskFail: '判定任务失败' };
            return {
                recover: saving.recover,
                confirmSaved: saving.confirmSaved,
                prompt: ['# Tasks', 'Initial data contains a page of task records; TasksRead selects a task or reads further pages. For a disputed status, compare the original objective with the relevant story passages.', 'When checking story evidence:', TASK_OBJECTIVE_POLICY, 'Only active tasks can be changed; rewards follow the existing contract. For a user-directed correction, record the instruction as the reason.'].join('\n'),
                initial: { items: project().slice(0, 20), total: records.length, nextOffset: records.length > 20 ? 20 : null },
                tools: [read, ...taskTools('This call saves the change and its reward settlement. Returns ok, status (saved/unchanged/failed) and data containing the current task or validation reports.').map(definition => ({
                    definition: definition as ManagementTool['definition'], effect: 'write' as const, label: labels[definition.function.name],
                    target: (a: Record<string, unknown>) => records.find(r => r.taskId === a.taskId)?.title ?? String(a.taskId ?? ''),
                }))],
                async execute(name, args, guard) {
                    if (name === 'TasksRead') {
                        await tasks.refreshCurrent(); records = tasks.readCurrent().records;
                        const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 20);
                        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) { throw new Error('tasks_read_range_invalid'); }
                        const items = project().filter(r => !args.taskId || r.taskId === args.taskId);
                        return { ok: true, status: 'read', data: { items: items.slice(offset, offset + limit), total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null } };
                    }
                    const compiled = compileTaskMaintenanceCommand(name, args, { records: new Map(records.map(r => [r.taskId, r])), staged: new Map(), createActionId: tasks.createActionId });
                    if (!compiled.command) { return { ok: compiled.result.ok, status: compiled.result.ok ? 'unchanged' : 'failed', data: compiled.result }; }
                    const command = compiled.command;
                    const observedAssistantCount = observedCount();
                    const savedResult = () => ({ ok: true, status: 'saved' as const, data: project().find(r => r.taskId === compiled.taskId) });
                    return saving.run(async commitGuard => {
                        const result = await tasks.commitMaintenance({ commands: [command], observedAssistantCount }, commitGuard);
                        records = result.view.records;
                        return savedResult();
                    }, async () => {
                        await tasks.refreshCurrent(); records = tasks.readCurrent().records;
                        const domain = tasks.readCurrent().domain;
                        if (domain?.events.some(event => event.actionId === command.actionId)) { return { status: 'confirmed', result: savedResult() }; }
                        const record = records.find(r => r.taskId === command.taskId);
                        return { status: record?.taskRevision === command.expectedTaskRevision && record.eventId === command.expectedEventId ? 'unchanged' : 'superseded' };
                    }, guard);
                },
            };
        },
    };
}
