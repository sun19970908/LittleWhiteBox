import type { AdministratorData, AdministratorOperation } from './types.js';
import { convertAdministratorV1 } from './format-v1.js';
export const createAdministratorData = (): AdministratorData => ({ schemaVersion: 2, revision: 0, turns: [], summary: null });
export function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new Error('administrator_data_invalid'); }
    return value as Record<string, unknown>;
}
export function parseAdministratorData(value: unknown): AdministratorData {
    const raw = object(value);
    const data = raw.schemaVersion === 1 ? object(convertAdministratorV1(raw)) : raw;
    if (data.schemaVersion !== 2 || !Number.isSafeInteger(data.revision) || Number(data.revision) < 0 || !Array.isArray(data.turns)) { throw new Error('administrator_data_invalid'); }
    const ids = new Set<string>();
    for (const raw of data.turns) {
        const turn = object(raw);
        if (typeof turn.id !== 'string' || !turn.id || ids.has(turn.id) || !Number.isFinite(turn.createdAt)
            || !['finished', 'interrupted', 'failed'].includes(String(turn.status)) || typeof turn.error !== 'string'
            || turn.assistant !== null && typeof turn.assistant !== 'string' || !Array.isArray(turn.operations)) { throw new Error('administrator_data_invalid'); }
        ids.add(turn.id);
        if (turn.assistantPayload !== undefined) { object(turn.assistantPayload); }
        validateToolMessages(turn.toolMessages);
        if (turn.user !== null) {
            const user = object(turn.user);
            if (typeof user.text !== 'string') { throw new Error('administrator_data_invalid'); }
            if (user.image !== undefined) {
                const image = object(user.image);
                if (typeof image.name !== 'string' || typeof image.path !== 'string' || !/^\/user\/images\/xb-os-admin-[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(png|jpeg|webp|gif)$/u.test(image.path)) { throw new Error('administrator_data_invalid'); }
            }
        }
        for (const item of turn.operations) {
            const op = object(item);
            if (['id', 'appId', 'name', 'target', 'summary'].some(k => typeof op[k] !== 'string') || !Number.isFinite(op.elapsedMs)
                || !['preparing', 'reading', 'saving', 'read', 'saved', 'unchanged', 'partial', 'failed', 'unconfirmed'].includes(String(op.status))) { throw new Error('administrator_data_invalid'); }
        }
    }
    if (data.summary !== null) {
        const summary = object(data.summary);
        if (typeof summary.text !== 'string' || typeof summary.throughId !== 'string' || !ids.has(summary.throughId)) { throw new Error('administrator_data_invalid'); }
        if (summary.throughToolMessage !== null) {
            const turn = data.turns.find(item => item.id === summary.throughId);
            if (!Number.isSafeInteger(summary.throughToolMessage) || Number(summary.throughToolMessage) <= 0
                || !toolMessageBoundaries(turn.toolMessages).includes(Number(summary.throughToolMessage))) { throw new Error('administrator_data_invalid'); }
        }
    }
    return structuredClone(data) as unknown as AdministratorData;
}
export function toolMessageBoundaries(messages: readonly { toolCalls?: readonly unknown[] }[]): number[] {
    const ends: number[] = [];
    for (let index = 0; index < messages.length;) { index += 1 + (messages[index].toolCalls?.length ?? 0); ends.push(index); }
    return ends;
}
function validateToolMessages(value: unknown): void {
    if (!Array.isArray(value)) { throw new Error('administrator_data_invalid'); }
    for (let index = 0; index < value.length;) {
        const assistant = object(value[index++]);
        if (assistant.role !== 'assistant' || typeof assistant.content !== 'string' || !Array.isArray(assistant.toolCalls) || !assistant.toolCalls.length) { throw new Error('administrator_data_invalid'); }
        if (assistant.providerPayload !== undefined) { object(assistant.providerPayload); }
        const ids = new Set<string>();
        for (const raw of assistant.toolCalls) {
            const call = object(raw), result = object(value[index++]);
            if (typeof call.id !== 'string' || !call.id || ids.has(call.id) || typeof call.name !== 'string' || !call.name || typeof call.arguments !== 'string'
                || call.providerId !== undefined && typeof call.providerId !== 'string'
                || result.role !== 'tool' || result.toolCallId !== call.id || result.toolName !== call.name || typeof result.content !== 'string') { throw new Error('administrator_data_invalid'); }
            ids.add(call.id);
        }
    }
}
export function invalidateSummary(data: AdministratorData, turnId: string): void {
    if (data.summary && data.turns.findIndex(t => t.id === turnId) <= data.turns.findIndex(t => t.id === data.summary!.throughId)) { data.summary = null; }
}
export function settledOperations(operations: readonly AdministratorOperation[]) {
    return operations.map(op => ({ ...op, status: op.status === 'saving' ? 'unconfirmed' as const : ['preparing', 'reading'].includes(op.status) ? 'failed' as const : op.status }));
}
