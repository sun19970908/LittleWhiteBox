import type {
    JsonValue,
    SidecarRevision,
    XiaobaiOsChatBindingV1,
    XiaobaiOsReferenceV1,
    XiaobaiOsSidecarV1,
} from './contracts.js';

const ENVELOPE_KEYS = ['binding', 'commitId', 'formatVersion', 'osId', 'partitions', 'revision'] as const;
const BINDING_KEYS = ['chatId', 'kind', 'ownerLocator'] as const;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

type UnknownRecord = Record<string, unknown>;

export class XiaobaiOsEnvelopeError extends Error {
    readonly code = 'invalid_envelope';

    constructor(message: string, readonly path = '') {
        super(message);
        this.name = 'XiaobaiOsEnvelopeError';
    }
}

export function isPlainRecord(value: unknown): value is UnknownRecord {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) { return false; }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value: UnknownRecord, expected: readonly string[], path: string): void {
    const actual = Object.keys(value).sort();
    const keys = [...expected].sort();
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
        throw new XiaobaiOsEnvelopeError(`${path} fields are invalid`, path);
    }
}

export function assertSafeId(value: unknown, path: string): asserts value is string {
    if (typeof value !== 'string' || !SAFE_ID.test(value)) {
        throw new XiaobaiOsEnvelopeError(`${path} must contain only letters, numbers, underscores or hyphens`, path);
    }
}

export function parseXiaobaiOsReference(value: unknown): XiaobaiOsReferenceV1 {
    if (!isPlainRecord(value)) {
        throw new XiaobaiOsEnvelopeError('reference must be an object', 'reference');
    }
    assertExactKeys(value, ['formatVersion', 'osId'], 'reference');
    if (value.formatVersion !== 1) {
        throw new XiaobaiOsEnvelopeError('reference.formatVersion must be 1', 'reference.formatVersion');
    }
    assertSafeId(value.osId, 'reference.osId');
    return { formatVersion: 1, osId: value.osId };
}

export function parseXiaobaiOsChatBinding(value: unknown): XiaobaiOsChatBindingV1 {
    if (!isPlainRecord(value)) {
        throw new XiaobaiOsEnvelopeError('binding must be an object', 'binding');
    }
    assertExactKeys(value, BINDING_KEYS, 'binding');
    if (value.kind !== 'character' && value.kind !== 'group') {
        throw new XiaobaiOsEnvelopeError('binding.kind must be character or group', 'binding.kind');
    }
    if (typeof value.ownerLocator !== 'string' || !value.ownerLocator) {
        throw new XiaobaiOsEnvelopeError('binding.ownerLocator must be a non-empty string', 'binding.ownerLocator');
    }
    if (typeof value.chatId !== 'string' || !value.chatId) {
        throw new XiaobaiOsEnvelopeError('binding.chatId must be a non-empty string', 'binding.chatId');
    }
    return {
        kind: value.kind,
        ownerLocator: value.ownerLocator,
        chatId: value.chatId,
    };
}

export function parseXiaobaiOsEnvelope(value: unknown): XiaobaiOsSidecarV1 {
    if (!isPlainRecord(value)) {
        throw new XiaobaiOsEnvelopeError('sidecar must be an object');
    }
    assertExactKeys(value, ENVELOPE_KEYS, 'sidecar');
    if (value.formatVersion !== 1) {
        throw new XiaobaiOsEnvelopeError('formatVersion must be 1', 'formatVersion');
    }
    assertSafeId(value.osId, 'osId');
    if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) {
        throw new XiaobaiOsEnvelopeError('revision must be a non-negative safe integer', 'revision');
    }
    assertSafeId(value.commitId, 'commitId');
    if (!isPlainRecord(value.partitions)) {
        throw new XiaobaiOsEnvelopeError('partitions must be a plain object', 'partitions');
    }
    return {
        formatVersion: 1,
        osId: value.osId,
        binding: parseXiaobaiOsChatBinding(value.binding),
        revision: Number(value.revision),
        commitId: value.commitId,
        // Partition internals deliberately remain opaque to the envelope parser.
        partitions: { ...value.partitions },
    };
}

function validateJsonValue(value: unknown, path: string, seen: Set<object>): asserts value is JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') { return; }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new XiaobaiOsEnvelopeError(`${path} contains a non-finite number`, path);
        }
        return;
    }
    if (typeof value !== 'object') {
        throw new XiaobaiOsEnvelopeError(`${path} is not a JSON value`, path);
    }
    if (seen.has(value)) {
        throw new XiaobaiOsEnvelopeError(`${path} contains a circular reference`, path);
    }
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((entry, index) => validateJsonValue(entry, `${path}[${index}]`, seen));
    } else {
        if (!isPlainRecord(value)) {
            throw new XiaobaiOsEnvelopeError(`${path} must use plain JSON objects`, path);
        }
        for (const [key, entry] of Object.entries(value)) {
            validateJsonValue(entry, `${path}.${key}`, seen);
        }
    }
    seen.delete(value);
}

export function assertJsonValue(value: unknown, path = 'value'): asserts value is JsonValue {
    validateJsonValue(value, path, new Set());
}

export function serializeXiaobaiOsEnvelope(value: XiaobaiOsSidecarV1): string {
    const parsed = parseXiaobaiOsEnvelope(value);
    assertJsonValue(parsed.partitions, 'partitions');
    return JSON.stringify(parsed);
}

export function cloneJsonValue<T>(value: T): T {
    assertJsonValue(value);
    return JSON.parse(JSON.stringify(value)) as T;
}

export function sidecarRevision(value: XiaobaiOsSidecarV1): SidecarRevision {
    return {
        osId: value.osId,
        revision: value.revision,
        commitId: value.commitId,
    };
}

export function sameSidecarRevision(left: SidecarRevision | null, right: XiaobaiOsSidecarV1 | null): boolean {
    if (left === null || right === null) { return left === null && right === null; }
    return left.osId === right.osId && left.revision === right.revision && left.commitId === right.commitId;
}
