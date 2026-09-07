import type { EconomyReadCapability } from '../../../capabilities/economy/index.js';
import type { XiaobaiOsExecutionScope } from '../../../kernel/execution-scope.js';
import type {
    XiaobaiOsAppRuntime,
    XiaobaiOsChatIdentity,
} from '../../../types.js';
import type { TasksService } from '../application/service.js';
import {
    createTaskControllerRuntime,
    type TaskControllerRuntimeDependencies,
} from './controller-runtime.js';

export interface TaskControllerDependencies extends Omit<
    TaskControllerRuntimeDependencies,
    'tasks' | 'economy' | 'subscribeData' | 'schedule' | 'getChatIdentity'
> {
    tasks: TasksService;
    economy: EconomyReadCapability;
    execution?: XiaobaiOsExecutionScope;
    getChatIdentity: () => XiaobaiOsChatIdentity | { key?: unknown } | string | null;
}

type TaskControllerRuntime = XiaobaiOsAppRuntime & {
    activate: NonNullable<XiaobaiOsAppRuntime['activate']>;
    handleMessage: NonNullable<XiaobaiOsAppRuntime['handleMessage']>;
};

export function createTaskController(dependencies: TaskControllerDependencies): TaskControllerRuntime {
    const { tasks, economy, execution, getChatIdentity, ...runtimeDependencies } = dependencies;
    return createTaskControllerRuntime({
        ...runtimeDependencies,
        tasks,
        getChatIdentity,
        economy,
        subscribeData: tasks.subscribe,
        schedule: execution
            ? task => {execution.setTimeout(task, 0);}
            : undefined,
    });
}
