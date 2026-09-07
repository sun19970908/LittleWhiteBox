import { validateGameDomain } from '../../domains/game/invariants.js';
import { createEmptyGameDomain } from '../../domains/game/timeline.js';
import type { GameDomainV1 } from '../../domains/game/types.js';
import type { PartitionRegistration } from '../../kernel/contracts.js';
import { GAME_APP_DESCRIPTOR } from './descriptor.js';

export const GAME_PARTITION: PartitionRegistration<GameDomainV1> = Object.freeze({
    key: 'game',
    ownerId: GAME_APP_DESCRIPTOR.id,
    schemaVersion: 1,
    parse(value: unknown) {
        try {
            validateGameDomain(value);
            return { ok: true as const, value: structuredClone(value) };
        } catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Game partition is invalid',
                },
            };
        }
    },
    serialize(value: GameDomainV1) {
        validateGameDomain(value);
        return structuredClone(value);
    },
    createInitial: createEmptyGameDomain,
});
