import { parseJsonInput } from './json-input.js';
import { readRecord, readRecords, writeRecord, prefixDigests, RECORD_VERSION } from './records.js';
import { calculateRebuild, publishRebuild } from './rebuild.js';

// Replacement and continuation submissions share ownership. Ordinary API calls
// and body initialization never acquire this marker and are never rolled back.
const TURN_SCOPE = 'turn';
const ERRORS = {
    invalid_turn_target: '只能更新最后一条 AI 回复的当前 swipe',
    stale_turn_target: '目标回复或变量已变化，请重新更新变量',
};
function fail(code) { throw Object.assign(new Error(ERRORS[code]), { code }); }

export function createTurnStateApi({ context, prepare, save, receipt, notify }) {
    function begin({ floor, swipeId } = {}, continuation = false, updating = false, observing = false) {
        const ctx = context();
        const message = ctx?.chat?.[floor];
        if (!ctx?.chatId || !Number.isInteger(floor) || !message || message.is_user || message.is_system
            || swipeId !== (message.swipe_id ?? 0)
            || (continuation ? floor !== ctx.chat.length - 1
                : !ctx.chat.slice(floor + 1).every(item => item?.is_user === true && !item.is_system))) fail('invalid_turn_target');
        const runtime = observing ? null : prepare(ctx, context);
        const records = readRecords(ctx.chat);
        const previous = readRecord(message);
        const entries = previous?.entries || [];
        const firstTurn = entries.findIndex(entry => entry.scope === TURN_SCOPE);
        const slot = continuation || firstTurn === -1 ? entries.length : firstTurn;
        const empty = { kind: 'call', source: 'json', scope: TURN_SCOPE, roots: [], ops: [] };
        // Replacement rolls back every owned batch on THIS floor only, leaving
        // one durable slot. Continuation does not publish anything until commit.
        const hasOld = firstTurn !== -1 && entries.some(entry => entry.scope === TURN_SCOPE && entry.ops.length);
        const deferred = updating && (entries.slice(slot).some(entry => entry.scope !== TURN_SCOPE)
            || records.slice(floor + 1).some(record => record?.entries.length));
        let rollbackRecord;
        if (!observing && !continuation && (hasOld || deferred || (firstTurn !== -1 && entries.some((entry, index) => index > firstTurn && entry.scope === TURN_SCOPE)))) {
            const kept = entries.filter(entry => entry.scope !== TURN_SCOPE);
            kept.splice(slot, 0, empty);
            records[floor] = { ...previous, v: RECORD_VERSION, entries: kept };
            // Only a pending suffix needs a durable execution cursor. Its requests
            // stay in their own swipes; there is no second variable state or copy.
            if (deferred) records[floor].resumeAt = slot;
            const prefix = deferred ? records.slice(0, floor + 1) : records;
            if (deferred) prefix[floor] = { ...records[floor], entries: kept.slice(0, slot) };
            const rebuilt = calculateRebuild(ctx, prefix, runtime.roots);
            rollbackRecord = records[floor];
            writeRecord(message, rollbackRecord);
            publishRebuild(ctx.chatMetadata, rebuilt);
            runtime.roots = rebuilt.roots;
            runtime.pendingTurn = deferred;
            save(ctx, context);
        }
        // Only the submission's durable slot survives refresh; the in-flight
        // request and stale-result check exist for this call only.
        const identity = [ctx.chatId, ctx.characterId, ctx.groupId];
        const chat = ctx.chat, metadata = ctx.chatMetadata;
        const body = message.mes;
        // Tail users are replayed, never rewritten. Snapshot their complete saved
        // content as well as object identity so a stale request cannot cross edits.
        const length = chat.length, tail = chat.slice(floor + 1);
        const tailContent = JSON.stringify(tail);
        const signature = () => JSON.stringify([
            prefixDigests(readRecords(chat)).at(-1),
            metadata.variables, metadata.LWB_RULES_V2,
        ]);
        const baseline = signature();
        let committed = false;
        function assertCurrent() {
            const current = context();
            if (committed || current?.chat !== chat || current.chatMetadata !== metadata
                || JSON.stringify([current.chatId, current.characterId, current.groupId]) !== JSON.stringify(identity)
                || current.chat.length !== length || current.chat[floor] !== message || message.is_user || message.is_system
                || (message.swipe_id ?? 0) !== swipeId || message.mes !== body
                || tail.some((item, index) => chat[floor + index + 1] !== item)
                || JSON.stringify(tail) !== tailContent || signature() !== baseline) fail('stale_turn_target');
        }
        const observation = { assertCurrent };
        if (observing) return observation;
        return {
            assertCurrent,
            rolledBack: Boolean(rollbackRecord),
            finish() {
                const current = context();
                if (committed || current?.chat !== chat || current.chatMetadata !== metadata
                    || JSON.stringify([current.chatId, current.characterId, current.groupId]) !== JSON.stringify(identity)
                    || readRecord(message) !== rollbackRecord || rollbackRecord?.resumeAt === undefined) return false;
                // Failure/cancellation restores only the retained later requests,
                // never the old AI submission that was explicitly rolled back.
                prepare(ctx, context);
                return true;
            },
            commit(input) {
                const ops = parseJsonInput(input);
                assertCurrent();
                const entry = { ...empty, ops };
                const next = readRecords(ctx.chat);
                const current = next[floor] || { v: RECORD_VERSION, entries: [] };
                const entries = current.entries.slice();
                entries[slot] = entry;
                next[floor] = { ...current, entries };
                delete next[floor].resumeAt;
                const rebuilt = calculateRebuild(ctx, next, runtime.roots, entry);
                const result = receipt(rebuilt.result);
                // Any operation error rejects this entire batch before publication.
                // Continuation keeps prior submissions; replacement keeps its rollback.
                if (result.errors.length) return { ...result, status: 'failed', changes: [], corrections: [] };
                writeRecord(message, rebuilt.records[floor]);
                publishRebuild(ctx.chatMetadata, rebuilt);
                runtime.roots = rebuilt.roots;
                runtime.pendingTurn = false;
                committed = true;
                save(ctx, context);
                notify(result, floor, rebuilt.result.changes);
                return result;
            },
        };
    }
    return {
        beginTurn: options => begin(options),
        beginContinuation: options => begin(options, true),
        beginUpdate: options => begin(options, false, true),
        observeTurn: options => begin(options, false, false, true),
    };
}

// Recover an interrupted independent update before any new state operation.
// Saved records own the suffix; removing the cursor and replaying them once
// retains user/API changes without resurrecting the removed turn submission.
export function resumePendingTurn(ctx, runtime) {
    if (!runtime.pendingTurn) return false;
    const records = readRecords(ctx.chat);
    const pending = records.flatMap((record, floor) => record?.resumeAt === undefined ? [] : [floor]);
    for (const floor of pending) {
        records[floor] = { ...records[floor] };
        delete records[floor].resumeAt;
    }
    const rebuilt = calculateRebuild(ctx, records, runtime.roots);
    for (const floor of pending) writeRecord(ctx.chat[floor], rebuilt.records[floor]);
    publishRebuild(ctx.chatMetadata, rebuilt);
    runtime.roots = rebuilt.roots;
    runtime.pendingTurn = false;
    return true;
}
