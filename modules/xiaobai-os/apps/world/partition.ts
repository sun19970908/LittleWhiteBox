import type { PartitionRegistration } from '../../kernel/contracts.js';
import { parseWorld } from '../../domains/world/invariants.js';
import { createEmptyWorld, type WorldDomainV1 } from '../../domains/world/types.js';

export const WORLD_PARTITION: PartitionRegistration<WorldDomainV1> = Object.freeze({
    key: 'world', ownerId: 'world', schemaVersion: 1,
    parse(value: unknown) {
        try { return { ok: true as const, value: parseWorld(value) }; }
        catch (error) {
            return { ok: false as const, error: { code: 'partition_invalid' as const,
                message: error instanceof Error ? error.message : 'Invalid world publication' } };
        }
    },
    serialize: parseWorld,
    createInitial: createEmptyWorld,
});
