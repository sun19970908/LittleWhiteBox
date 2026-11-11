import { extractStateBlocks, parseStateBlock } from './parser.js';
import { getRootFromPath } from './executor.js';
import { validateJsonBatch } from './json-input.js';
import { parsePath, formatPath } from './path.js';
import { upgradeV1Record, parseV1Path } from './path-v1.js';

export const RECORD_KEY = 'LittleWhiteBox_state2';
export const RECORD_VERSION = 2;
const fingerprints = new WeakMap();
const convertedRecords = new WeakMap();

export function currentRecord(record) {
    if (record?.v === 1 && Array.isArray(record.entries)) {
        if (!convertedRecords.has(record)) convertedRecords.set(record, upgradeV1Record(record));
        return convertedRecords.get(record);
    }
    if (record?.v !== RECORD_VERSION || !Array.isArray(record.entries)) throw new Error('invalid_state_record');
    return record;
}

/** Syntax-only upgrade, including inactive swipes. Values and historical requests are not replayed. */
export function upgradeChatPaths(ctx, legacyConverted = false) {
    const replacements = [];
    for (const message of ctx.chat) {
        for (const holder of [message, ...(message.swipe_info || [])]) {
            const record = holder?.extra?.[RECORD_KEY];
            if (record?.v === 1) replacements.push([holder, currentRecord(record)]);
        }
    }
    if (!replacements.length && !legacyConverted) return false;
    const rules = Object.fromEntries(Object.entries(ctx.chatMetadata.LWB_RULES_V2 || {}).map(([path, rule]) =>
        [formatPath(parseV1Path(path, true)), rule]));
    for (const [holder, record] of replacements) holder.extra[RECORD_KEY] = record;
    ctx.chatMetadata.LWB_RULES_V2 = rules;
    return true;
}

// Two independent 32-bit accumulators; these are cache/content fingerprints, not IDs.
export function fingerprint(text) {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        a = Math.imul(a ^ code, 16777619);
        b = Math.imul(b, 33) ^ code;
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function bodyBlocks(text) {
    return extractStateBlocks(text).map(block => ({ text: block, digest: fingerprint(block.trim()) }));
}

export function readRecord(message) {
    const record = message?.extra?.[RECORD_KEY];
    if (record === undefined) return undefined;
    return currentRecord(record);
}

export function readRecords(chat) {
    return chat.map(readRecord);
}

// The host owns swipe snapshots. Only its selected, existing snapshot is mirrored.
export function writeRecord(message, record) {
    if (record !== undefined) record = currentRecord(record);
    message.extra ||= {};
    if (record === undefined) delete message.extra[RECORD_KEY];
    else message.extra[RECORD_KEY] = record;
    const swipe = message.swipe_info?.[message.swipe_id ?? 0];
    if (swipe) {
        swipe.extra ||= {};
        if (record === undefined) delete swipe.extra[RECORD_KEY];
        else swipe.extra[RECORD_KEY] = structuredClone(record);
    }
}

export function parseEntry(blocks, kind = 'text') {
    const parsed = blocks.map(block => parseStateBlock(block.text));
    const ops = parsed.flatMap(block => block.ops).map(op => ({ ...op, path: parsePath(op.path), source: op.source || 'text' }));
    validateJsonBatch(ops);
    const entry = {
        kind, ...(kind === 'call' ? { source: 'text' } : {}),
        blocks: blocks.map(block => block.digest),
        rules: parsed.flatMap(block => block.rules).map(item => ({ ...item, path: parsePath(item.path, { pattern: true }) })),
        ops,
    };
    return { ...entry, roots: [...deriveEntryRoots(entry)] };
}

export function bodyUpdate(record, blocks) {
    const previous = (record?.entries || []).filter(entry => entry.kind === 'text').flatMap(entry => entry.blocks);
    const current = blocks.map(block => block.digest);
    if (!current.length || (previous.length === current.length && previous.every((value, index) => value === current[index]))) {
        return { kind: 'unchanged' };
    }
    const append = previous.length <= current.length && previous.every((value, index) => value === current[index]);
    return { kind: append ? 'append' : 'replace', blocks: append ? blocks.slice(previous.length) : blocks };
}

export function withEntry(record, entry, replaceBody = false) {
    // Only new intake is finalized here; stored entries must already declare their claims.
    // Keep this caller-owned entry's identity for replay receipts.
    if (!Object.hasOwn(entry, 'roots')) entry.roots = [...deriveEntryRoots(entry)];
    const entries = record?.entries || [];
    if (!replaceBody) return { v: RECORD_VERSION, entries: [...entries, entry] };
    const next = [];
    let inserted = false;
    for (const existing of entries) {
        if (existing.kind !== 'text') next.push(existing);
        else if (!inserted) { next.push(entry); inserted = true; }
    }
    if (!inserted) next.push(entry);
    return { v: RECORD_VERSION, entries: next };
}

/** Intake claims for new entries; JSON requests never claim roots. */
export function deriveEntryRoots(entry) {
    const roots = new Set();
    for (const item of [...(entry.rules || []), ...(entry.ops || []).filter(op => op.source !== 'json')]) {
        const root = getRootFromPath(item.path);
        if (root) roots.add(root);
    }
    return roots;
}

/** Persisted claims are factual scope, not inferred execution effects. */
export function entryRoots(entry) {
    if (!Array.isArray(entry.roots) || entry.roots.some(root => typeof root !== 'string' || !root)) {
        throw new Error('invalid_state_record');
    }
    return new Set(entry.roots);
}

export function ownedRoots(records) {
    const roots = new Set();
    for (const record of records) {
        for (const entry of record?.entries || []) {
            for (const root of entryRoots(entry)) roots.add(root);
        }
    }
    return roots;
}

export function prefixDigests(records) {
    let prefix = '';
    return records.map(record => {
        let digest = record && fingerprints.get(record);
        if (!digest) {
            digest = fingerprint(JSON.stringify(record || null));
            if (record) fingerprints.set(record, digest);
        }
        prefix = fingerprint(`${prefix}:${digest}`);
        return prefix;
    });
}
