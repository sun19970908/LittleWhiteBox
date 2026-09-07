import { projectTaskRecords } from '../../../domains/tasks/projection.js';
import type { TaskDomainV1, TaskRecord } from '../../../domains/tasks/types.js';
import type { PartitionSnapshot, ScopedChatStore } from '../../../kernel/contracts.js';
import type { XiaobaiOsAppRuntime } from '../../../types.js';

export interface TaskCompletionNotice {
    title: string;
    message: string;
}

function completionNotice(task: TaskRecord): TaskCompletionNotice {
    const amount = task.reward.toLocaleString('zh-CN');
    return {
        title: task.source === 'received' ? '接取的任务已完成' : '发布的委托已完成',
        message: task.source === 'received'
            ? `「${task.title}」已完成，${amount} 小白币已到账。`
            : `「${task.title}」已由${task.assignee!.displayName}完成，托管的 ${amount} 小白币已支付给执行者。`,
    };
}

/** Observes confirmed commits even while the OS is closed; history is never replayed as new notices. */
export function createTaskCompletionRuntime(dependencies: {
    store: Pick<ScopedChatStore<TaskDomainV1>, 'peekCurrent' | 'subscribe'>;
    notify(notice: TaskCompletionNotice): void;
}): XiaobaiOsAppRuntime {
    let unsubscribe: (() => void) | null = null;
    let identityKey: string | null = null;
    let osId: string | null = null;
    const seen = new Set<string>();

    function reset(): void {
        identityKey = null;
        osId = null;
        seen.clear();
    }

    function seedCurrent(): void {
        // A damaged Tasks partition must not prevent the other OS runtimes from starting.
        try {
            const current = dependencies.store.peekCurrent();
            if (current) {observe(current);}
        } catch (error) { console.warn('[LittleWhiteBox] 暂时无法读取任务通知基线', error); }
    }

    function observe(snapshot: PartitionSnapshot<TaskDomainV1>): void {
        const current = dependencies.store.peekCurrent();
        if (!snapshot.osId || current?.identityKey !== snapshot.identityKey || current.osId !== snapshot.osId) {return;}
        const baseline = identityKey !== snapshot.identityKey || osId !== snapshot.osId;
        if (baseline) {
            reset();
            identityKey = snapshot.identityKey;
            osId = snapshot.osId;
        }
        const records = snapshot.value ? projectTaskRecords(snapshot.value) : [];
        for (const task of records) {
            if (task.status !== 'completed' || seen.has(task.eventId)) {continue;}
            seen.add(task.eventId);
            if (baseline) {continue;}
            try { dependencies.notify(completionNotice(task)); }
            catch (error) { console.warn('[LittleWhiteBox] 任务完成通知未能显示', error); }
        }
    }

    return {
        startBackground() {
            if (unsubscribe) {return;}
            seedCurrent();
            unsubscribe = dependencies.store.subscribe(observe);
        },
        stopBackground() { unsubscribe?.(); unsubscribe = null; reset(); },
        handleChatChanged() {
            reset();
            seedCurrent();
        },
    };
}
