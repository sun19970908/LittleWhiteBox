import type { TaskHistoryPage } from '../types.js';

export interface TaskHistoryRequestBoundary {
    readonly cursor: string;
    readonly stateVersion: number;
}

export function mergeTaskHistoryPage(
    current: TaskHistoryPage,
    incoming: TaskHistoryPage,
    boundary: TaskHistoryRequestBoundary,
    currentStateVersion: number,
): TaskHistoryPage | null {
    if (currentStateVersion !== boundary.stateVersion || current.nextCursor !== boundary.cursor) {return null;}
    const known = new Set(current.items.map(task => task.taskId));
    return {
        items: [...current.items, ...incoming.items.filter(task => !known.has(task.taskId))],
        nextCursor: incoming.nextCursor,
        hasMore: incoming.hasMore,
    };
}
