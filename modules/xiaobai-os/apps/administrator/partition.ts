import type { PartitionRegistration } from '../../kernel/contracts.js';
import { createAdministratorData } from './domain/data.js';

export interface AdministratorStored { raw: unknown }
// The wrapper distinguishes a corrupt JSON null from an absent partition. The repository owns validation.
// Kernel cloning must preserve invalid raw data so this APP can explicitly clear it.
export const ADMINISTRATOR_PARTITION: PartitionRegistration<unknown> = Object.freeze({
    key: 'administrator', ownerId: 'administrator', schemaVersion: 1,
    parse: (raw: unknown) => ({ ok: true as const, value: { raw } }),
    serialize: (value: unknown) => (value as AdministratorStored).raw, createInitial: () => ({ raw: createAdministratorData() }),
});
