import type { PartitionRegistration } from '../../kernel/contracts.js';
import { validateShopDomain } from '../../domains/shop/invariants.js';
import { createEmptyShopState } from '../../domains/shop/timeline.js';
import type { ShopDomainV2 } from '../../domains/shop/types.js';
import { SHOP_APP_DESCRIPTOR } from './descriptor.js';

function parseShopPartition(value: unknown): ShopDomainV2 {
    validateShopDomain(value);
    return structuredClone(value);
}

export const SHOP_PARTITION: PartitionRegistration<ShopDomainV2> = Object.freeze({
    key: 'shop',
    ownerId: SHOP_APP_DESCRIPTOR.id,
    schemaVersion: 2,
    parse(value: unknown) {
        try { return { ok: true as const, value: parseShopPartition(value) }; }
        catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Shop partition is invalid',
                },
            };
        }
    },
    serialize: parseShopPartition,
    createInitial: createEmptyShopState,
});
