import type { PartitionRegistration } from '../../kernel/contracts.js';
import { validateBankDomain } from '../../domains/bank/invariants.js';
import { createEmptyBankDomain } from '../../domains/bank/timeline.js';
import type { BankDomainV1 } from '../../domains/bank/types.js';
import { BANK_APP_DESCRIPTOR } from './descriptor.js';

function parseBankPartition(value: unknown): BankDomainV1 {
    validateBankDomain(value);
    return structuredClone(value);
}

export const BANK_PARTITION: PartitionRegistration<BankDomainV1> = Object.freeze({
    key: 'bank',
    ownerId: BANK_APP_DESCRIPTOR.id,
    schemaVersion: 1,
    parse(value: unknown) {
        try { return { ok: true as const, value: parseBankPartition(value) }; }
        catch (error) {
            return {
                ok: false as const,
                error: {
                    code: 'partition_invalid' as const,
                    message: error instanceof Error ? error.message : 'Bank partition is invalid',
                },
            };
        }
    },
    serialize: parseBankPartition,
    createInitial: createEmptyBankDomain,
});
