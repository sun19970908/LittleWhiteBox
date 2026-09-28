import type { UserTransactions } from '../../../kernel/user-transactions.js';
import { TASKS_PARTITION } from '../partition.js';
import { upgradeLegacyTasks } from './legacy-v1.js';

export async function upgradeTasksUserFile(files: UserTransactions): Promise<void> {
    const result = await files.transactOwned(TASKS_PARTITION, [], access => {
        for (const { scopeId, raw } of access.stories()) {
            if (raw && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion === 2) {
                TASKS_PARTITION.serialize(raw as Parameters<typeof TASKS_PARTITION.serialize>[0]);
                continue;
            }
            access.replaceStory(scopeId, upgradeLegacyTasks(raw));
        }
    });
    if (result.status !== 'confirmed' && result.status !== 'unchanged') {
        const error = 'error' in result ? result.error : undefined;
        throw Object.assign(new Error(error?.message || `tasks_upgrade_${result.status}`), {
            code: error?.code || `tasks_upgrade_${result.status}`,
            uncertain: result.status === 'unconfirmed',
        });
    }
}
