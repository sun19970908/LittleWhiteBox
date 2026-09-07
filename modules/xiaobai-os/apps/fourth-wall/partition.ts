import type { PartitionRegistration } from '../../kernel/contracts.js';
import { createDefaultFourthWallChatState } from './domain/defaults.js';
import { parseFourthWallChatState } from './domain/state.js';
import type { FourthWallPartitionV1 } from './types.js';
import { FOURTH_WALL_APP_DESCRIPTOR } from './descriptor.js';

function parsePartition(value: unknown): FourthWallPartitionV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('partitions.fourthWall must be an object');
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length !== 2 || keys[0] !== 'schemaVersion' || keys[1] !== 'state') {
        throw new TypeError('partitions.fourthWall has non-canonical fields');
    }
    if (record.schemaVersion !== 1) {
        throw new TypeError('partitions.fourthWall has an unsupported schemaVersion');
    }
    return { schemaVersion: 1, state: parseFourthWallChatState(record.state) };
}

export const FOURTH_WALL_PARTITION: PartitionRegistration<FourthWallPartitionV1> = Object.freeze({
    key: 'fourthWall',
    ownerId: FOURTH_WALL_APP_DESCRIPTOR.id,
    schemaVersion: 1,
    parse(value: unknown) {
        try { return { ok: true as const, value: parsePartition(value) }; }
        catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Fourth Wall partition is invalid',
                },
            };
        }
    },
    serialize: parsePartition,
    createInitial: () => ({ schemaVersion: 1 as const, state: createDefaultFourthWallChatState(Date.now()) }),
});
