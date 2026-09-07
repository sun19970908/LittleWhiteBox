import type { PartitionRegistration } from '../../kernel/contracts.js';
import { emptyMessages, type MessagesDomainV1 } from '../../domains/messages/types.js';
import { validateMessages } from '../../domains/messages/invariants.js';

export const MESSAGES_PARTITION: PartitionRegistration<MessagesDomainV1> = Object.freeze({
    key: 'messages', ownerId: 'messages', schemaVersion: 1,
    createInitial: emptyMessages,
    parse(value: unknown) {
        try {validateMessages(value); return { ok: true as const, value: structuredClone(value) };}
        catch {return { ok: false as const, error: { code: 'partition_invalid' as const, message: '信息记录格式无效，请核实文件。' } };}
    },
    serialize(value: MessagesDomainV1) {validateMessages(value); return structuredClone(value);},
});
