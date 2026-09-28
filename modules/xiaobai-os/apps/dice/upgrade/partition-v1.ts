import { assertJsonValue } from '../../../kernel/envelope.js';
import type { UserTransactions } from '../../../kernel/user-transactions.js';
import { DICE_PARTITION } from '../partition.js';

/** Production Dice { sheet } user partition. Remove when v1 imports are retired. */
interface DicePartitionV1 { sheet: unknown }
export function convertDicePartitionV1(raw: unknown) {
    assertJsonValue(raw);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).join(',') !== 'sheet') {
        throw new TypeError('dice_partition_v1_invalid');
    }
    const previous: DicePartitionV1 = { sheet: raw.sheet };
    return { sheet: structuredClone(previous.sheet), resultOverrides: {} };
}

export async function upgradeDiceUserFile(files: UserTransactions): Promise<void> {
    const result = await files.transactOwned(DICE_PARTITION, [], access => {
        const raw = access.global();
        if (raw === null || DICE_PARTITION.parse(raw).ok) { return; }
        access.replaceGlobal(convertDicePartitionV1(raw));
    });
    if (result.status !== 'confirmed' && result.status !== 'unchanged') {
        throw Object.assign(new Error('dice_upgrade_failed'), { code: 'dice_upgrade_failed' });
    }
}
