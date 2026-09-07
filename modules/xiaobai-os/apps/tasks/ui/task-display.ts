import type { TaskRecord, TasksPresentation } from '../types.js';

export const taskStatusLabel = {
    recruiting: '招募中', active: '进行中', completed: '已完成', failed: '未完成', cancelled: '已取消',
} as const;

export function taskMoney(value: number): string {
    return value.toLocaleString('zh-CN');
}

export function taskIssuer(task: TaskRecord): string {
    return task.source === 'received' ? '任务终端' : `${task.issuer.displayName}（你）`;
}

export function taskLanes(state: Pick<TasksPresentation, 'active' | 'recruiting'>): { received: TaskRecord[]; published: TaskRecord[] } {
    return {
        received: state.active.filter(task => task.source === 'received'),
        published: [...state.recruiting, ...state.active.filter(task => task.source === 'published')]
            .sort((a, b) => b.updatedAt - a.updatedAt || b.taskId.localeCompare(a.taskId)),
    };
}
