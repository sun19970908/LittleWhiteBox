import {
    MAX_TASK_PROGRESS_SUMMARY_LENGTH,
    MAX_TASK_RESULT_SUMMARY_LENGTH,
    TASK_MAX_ID_LENGTH,
} from '../../../domains/tasks/invariants.js';
import type { MaintenanceFunctionDeclaration } from '../../../capabilities/maintenance/registry.js';

export const TASK_MAINTENANCE_TOOL_NAMES = Object.freeze({
    PROGRESS: 'TaskProgress',
    COMPLETE: 'TaskComplete',
    FAIL: 'TaskFail',
} as const);

const IDENTITY_PROPERTIES = Object.freeze({
    taskId: {
        type: 'string',
        minLength: 1,
        maxLength: TASK_MAX_ID_LENGTH,
        description: 'Exact active taskId from the untrusted active-task data.',
    },
    revision: {
        type: 'integer',
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
        description: 'Exact current revision from this task’s supplied record.',
    },
});

function tool(
    name: string,
    description: string,
    summaryName: 'progressSummary' | 'resultSummary',
    summaryDescription: string,
    maximum: number,
    saveDescription: string,
): MaintenanceFunctionDeclaration {
    return Object.freeze({
        type: 'function' as const,
        function: {
            name,
            description: [
                description,
                saveDescription,
            ].join('\n'),
            parameters: {
                type: 'object',
                properties: {
                    ...IDENTITY_PROPERTIES,
                    [summaryName]: {
                        type: 'string',
                        minLength: 1,
                        maxLength: maximum,
                        description: summaryDescription,
                    },
                },
                required: ['taskId', 'revision', summaryName],
                additionalProperties: false,
            },
        },
    });
}

export function taskTools(saveDescription: string): readonly MaintenanceFunctionDeclaration[] { return Object.freeze([
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.PROGRESS,
        'Record changed facts for a task that remains active.',
        'progressSummary',
        'Replaces the previous summary with cumulative confirmed facts relevant to objective. Record what happened, without inferred conditions, remaining-work analysis or advice.',
        MAX_TASK_PROGRESS_SUMMARY_LENGTH,
        saveDescription,
    ),
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.COMPLETE,
        'Complete an active task. The app settles its existing reward when the change is saved.',
        'resultSummary',
        'The result that satisfied objective, or the explicit management instruction for this correction.',
        MAX_TASK_RESULT_SUMMARY_LENGTH,
        saveDescription,
    ),
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.FAIL,
        'Fail an active task. The app refunds its existing escrow when the change is saved.',
        'resultSummary',
        'The result establishing irreversible failure or expiry of objective, or the explicit management instruction for this correction.',
        MAX_TASK_RESULT_SUMMARY_LENGTH,
        saveDescription,
    ),
]); }
export const TASK_MAINTENANCE_TOOLS = taskTools('Changes remain pending until the app saves them after this run. Returns ok, status (updated/unchanged/failed), changed, applied/skipped task reports, warnings and an optional recovery hint.');
