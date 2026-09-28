// Compatibility: upstream/main Fourth Wall schema 2 (1dee0b80), before assistant prefill was removed.
// Retire only when importing those already-issued sidecars is explicitly discontinued.
import { parseFourthWallChatState } from '../domain/state.js';
import type { FourthWallPartition } from '../types.js';

export interface FourthWallChatStateV2 {
    settings: { maxChatLayers: number; stream: boolean; disableAssistantPrefill: boolean };
    sessions: Array<{
        id: string; name: string; createdAt: number;
        history: Array<{ role: 'user' | 'ai'; content: string; ts: number; thinking?: string; type?: string }>;
        memory: string; archivedCount: number;
    }>;
    activeSessionId: string;
}
export interface FourthWallPartitionV2 { schemaVersion: 2; state: FourthWallChatStateV2 }

function record(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${path} must be an object`);
    }
    return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], path: string): void {
    const expected = [...keys].sort();
    const actual = Object.keys(value).sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        throw new TypeError(`${path} has non-canonical fields`);
    }
}

function string(value: unknown, path: string): string {
    if (typeof value !== 'string') { throw new TypeError(`${path} must be a string`); }
    return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
        throw new TypeError(`${path} must be an integer from ${min} to ${max}`);
    }
    return Number(value);
}

/** Frozen schema-2 parser; the current state parser must never interpret this historical shape. */
export function parseFourthWallChatStateV2(value: unknown): FourthWallChatStateV2 {
    const path = 'partitions.fourthWall';
    const state = record(value, path);
    exactKeys(state, ['settings', 'sessions', 'activeSessionId'], path);
    const settings = record(state.settings, `${path}.settings`);
    exactKeys(settings, ['maxChatLayers', 'stream', 'disableAssistantPrefill'], `${path}.settings`);
    integer(settings.maxChatLayers, `${path}.settings.maxChatLayers`, 1, 9999);
    if (typeof settings.stream !== 'boolean' || typeof settings.disableAssistantPrefill !== 'boolean') {
        throw new TypeError(`${path}.settings flags must be boolean`);
    }
    if (!Array.isArray(state.sessions) || state.sessions.length === 0) {
        throw new TypeError(`${path}.sessions must not be empty`);
    }
    const ids = new Set<string>();
    for (const [index, rawSession] of state.sessions.entries()) {
        const sessionPath = `${path}.sessions[${index}]`;
        const session = record(rawSession, sessionPath);
        exactKeys(session, ['id', 'name', 'createdAt', 'history', 'memory', 'archivedCount'], sessionPath);
        const id = string(session.id, `${sessionPath}.id`);
        if (!id || ids.has(id)) { throw new TypeError(`${path}.sessions ids must be non-empty and unique`); }
        ids.add(id);
        string(session.name, `${sessionPath}.name`);
        if (!Number.isFinite(session.createdAt)) { throw new TypeError(`${sessionPath}.createdAt must be finite`); }
        if (!Array.isArray(session.history)) { throw new TypeError(`${sessionPath}.history must be an array`); }
        string(session.memory, `${sessionPath}.memory`);
        integer(session.archivedCount, `${sessionPath}.archivedCount`, 0, session.history.length);
        for (const [messageIndex, rawMessage] of session.history.entries()) {
            const messagePath = `${sessionPath}.history[${messageIndex}]`;
            const message = record(rawMessage, messagePath);
            const keys = ['role', 'content', 'ts'];
            if (message.thinking !== undefined) { keys.push('thinking'); }
            if (message.type !== undefined) { keys.push('type'); }
            exactKeys(message, keys, messagePath);
            if (message.role !== 'user' && message.role !== 'ai') { throw new TypeError('fourth-wall message role is invalid'); }
            string(message.content, 'fourth-wall message content');
            if (!Number.isFinite(message.ts)) { throw new TypeError('fourth-wall message timestamp must be finite'); }
            if (message.thinking !== undefined) { string(message.thinking, 'message.thinking'); }
            if (message.type !== undefined) { string(message.type, 'message.type'); }
        }
    }
    const activeSessionId = string(state.activeSessionId, `${path}.activeSessionId`);
    if (!ids.has(activeSessionId)) { throw new TypeError(`${path}.activeSessionId must reference a session`); }
    return structuredClone(value) as FourthWallChatStateV2;
}

export function upgradeFourthWallV2(partition: FourthWallPartitionV2): FourthWallPartition {
    const old = parseFourthWallChatStateV2(partition.state);
    return { schemaVersion: 3, state: parseFourthWallChatState({
        settings: { maxChatLayers: old.settings.maxChatLayers, stream: old.settings.stream },
        sessions: old.sessions,
        activeSessionId: old.activeSessionId,
    }) };
}
