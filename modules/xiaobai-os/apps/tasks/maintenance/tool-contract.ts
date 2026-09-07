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
        description: 'Exact current task revision shown for this task. Used for CAS.',
    },
});

function tool(
    name: string,
    description: string,
    summaryName: 'progressSummary' | 'resultSummary',
    summaryDescription: string,
    maximum: number,
): MaintenanceFunctionDeclaration {
    return Object.freeze({
        type: 'function' as const,
        function: {
            name,
            description,
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

export const TASK_MAINTENANCE_TOOLS: readonly MaintenanceFunctionDeclaration[] = Object.freeze([
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.PROGRESS,
        '记录既有 active 任务朝 exact objective 的实质变化，仅当它尚未完成或失败。玩家执行只认接受 RP 的直接证据；世界 NPC 执行才可保守参考 elapsedAssistantReplies、capability、risk 和既有 progress。progressSummary 整体替换旧值，只写累计确认事实与剩余差距。不能创建任务、改钱或把 requirements/hook/risk 变成附加目标。',
        'progressSummary',
        'Replacement cumulative objective-only state: confirmed progress and exact remaining gap; never a turn recap.',
        MAX_TASK_PROGRESS_SUMMARY_LENGTH,
    ),
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.COMPLETE,
        '仅在可信证据已经满足既有 active 任务的 exact objective 时完成。裸称“做完了”不是证据；一旦实际交付或结果已满足目标，应立即 Complete，不能为制造戏剧继续 Progress。只会结算既有 escrow，不能创建任务、花玩家新资金或增加目标。',
        'resultSummary',
        'Concrete terminal outcome and accepted evidence that satisfied the exact objective.',
        MAX_TASK_RESULT_SUMMARY_LENGTH,
    ),
    tool(
        TASK_MAINTENANCE_TOOL_NAMES.FAIL,
        '仅在可信证据表明 exact objective 已不可逆失败或明确过期时失败。普通挫折、风险出现、关系恶化或进度缓慢不等于终态。只会按既有合同退款，不能创建任务、罚款或增加目标。',
        'resultSummary',
        'Concrete irreversible failure or expiry and the accepted evidence that made it terminal.',
        MAX_TASK_RESULT_SUMMARY_LENGTH,
    ),
]);
