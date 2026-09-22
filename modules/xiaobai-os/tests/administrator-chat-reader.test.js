import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdministratorChatReader } from '../apps/administrator/host/chat-reader.js';
import { MANAGEMENT_READ_CHARS } from '../capabilities/management/read-page.js';

function readerFixture() {
    const surface = { identityKey: 'fixture', playerName: '玩家', assistantName: '旁白', messages: Array.from({ length: 70 }, (_, i) => ({ mes: `楼层-${i}`, name: '旁白', swipe_id: 0 })) };
    const abort = new AbortController();
    return { surface, abort, reader: createAdministratorChatReader(() => surface, () => abort.signal) };
}
test('administrator floors are zero based, inclusive and keep original indices through filtering and pagination', async () => {
    const { surface, reader } = readerFixture(); surface.messages[4].is_system = true;
    for (const floor of [0, 55, 69]) { const value = await reader.read({ from: floor }); assert.equal(value.items[0].floor, floor); assert.equal(value.items[0].text, `楼层-${floor}`); }
    const floors = []; let args = { from: 0, to: 69 };
    do { const value = await reader.read(args); floors.push(...value.items.map(item => item.floor)); args = value.next; } while (args);
    assert.deepEqual(floors, Array.from({ length: 70 }, (_, i) => i).filter(i => i !== 4));
    const omitted = await reader.read({ from: 4 });
    assert.deepEqual(omitted.omittedSystemFloors, [4]); assert.deepEqual(omitted.scanned, { from: 4, to: 4 }); assert.deepEqual(omitted.items, []);
});
test('long floor continuation reconstructs exact Unicode text; edited or swiped evidence cannot authorize a write', async () => {
    const { surface, reader } = readerFixture();
    const original = '字'.repeat(MANAGEMENT_READ_CHARS - 1) + '🙂'.repeat(15000);
    surface.messages[55].mes = original;
    let joined = '', args = { from: 55 };
    do { const result = await reader.read(args); joined += result.items[0].text; args = result.next; } while (args);
    assert.equal(joined, original); assert.equal(reader.isCurrent(), true);
    surface.messages[55].swipe_id = 1; assert.equal(reader.isCurrent(), false); assert.deepEqual(reader.staleFloors(), [55]);
    await reader.read({ from: 55 }); assert.equal(reader.isCurrent(), true);
    surface.messages[55].mes += '改'; assert.equal(reader.isCurrent(), false);
});
test('literal search pages without shifted floors or regex injection; scans can be cancelled', async () => {
    const { surface, reader, abort } = readerFixture();
    surface.messages.forEach((m, i) => { m.mes = i === 55 ? 'İabc [x].*' : '[x].*'; });
    let args = { query: '[x].*' }; const floors = [];
    do { const result = await reader.search(args); floors.push(...result.items.map(item => item.floor)); args = result.next; } while (args);
    assert.equal(floors.length, 70); assert.equal(new Set(floors).size, 70);
    const result = await reader.search({ query: 'abc', from: 55, to: 55 }); assert.equal(result.items[0].snippet, 'İabc [x].*');
    const pending = reader.search({ query: 'none' }); abort.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
});

test('continuing an edited floor cannot replace the earlier page evidence', async () => {
    for (const change of ['text', 'swipe']) {
        const { surface, reader } = readerFixture();
        surface.messages[55].mes = 'a'.repeat(MANAGEMENT_READ_CHARS * 2);
        const page = await reader.read({ from: 55 });
        if (change === 'text') { surface.messages[55].mes = 'b' + surface.messages[55].mes.slice(1); }
        else { surface.messages[55].swipe_id++; }
        await assert.rejects(reader.read(page.next));
        assert.equal(reader.isCurrent(), false);
        await reader.read({ from: 55 });
        assert.equal(reader.isCurrent(), true);
    }
});
