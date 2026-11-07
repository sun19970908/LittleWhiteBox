import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from '../runtime/persistence.js';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

test('K10: saving is serial, repeated pending selections coalesce, and chats never replace each other', async () => {
    const enqueue = createSaveQueue(), first = deferred(), a = {}, b = {}, writes: string[] = [];
    const saving = enqueue(a, async () => { writes.push('a1'); await first.promise; });
    await Promise.resolve();
    const obsolete = enqueue(a, async () => { writes.push('a2'); });
    const otherChat = enqueue(b, async () => { writes.push('b1'); });
    const latest = enqueue(a, async () => { writes.push('a3'); });
    assert.deepEqual(writes, ['a1']);
    first.resolve();
    await Promise.all([saving, obsolete, otherChat, latest]);
    assert.deepEqual(writes, ['a1', 'a3', 'b1']);
    await enqueue(a, async () => { writes.push('a4'); });
    assert.equal(writes.at(-1), 'a4');
});

test('K6/K10: save failures reach every affected caller without blocking later saves or retries', async () => {
    const enqueue = createSaveQueue(), first = deferred(), chat = {}, writes: string[] = [];
    const saving = enqueue(chat, async () => { await first.promise; throw new Error('first offline'); });
    const failedFirst = assert.rejects(saving, /first offline/);
    await Promise.resolve();
    const skipped = enqueue(chat, async () => { writes.push('obsolete'); });
    const failedSkipped = assert.rejects(skipped, /latest offline/);
    const latest = enqueue(chat, async () => { writes.push('latest'); throw new Error('latest offline'); });
    const failedLatest = assert.rejects(latest, /latest offline/);
    first.resolve();
    await Promise.all([failedFirst, failedSkipped, failedLatest]);
    await enqueue(chat, async () => { writes.push('retry'); });
    assert.deepEqual(writes, ['latest', 'retry']);
    await assert.rejects(enqueue(chat, () => { throw new Error('synchronous failure'); }), /synchronous failure/);
    await enqueue(chat, async () => { writes.push('after synchronous failure'); });
    assert.equal(writes.at(-1), 'after synchronous failure');
});
