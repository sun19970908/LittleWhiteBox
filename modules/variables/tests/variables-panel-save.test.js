import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { PANEL_COPY } from '../variables-panel-copy.js';

// P1: a save starts against the original chat before yielding, even if navigation
// happens before acknowledgement (lost values / cross-chat writes).
// P2: native save resolution alone cannot report success; failed/mismatched disk
// values reject, and retry saves without replaying an edit (invisible data loss).
function harness({ group = false, legacy = false } = {}) {
    let ctx = { chatId: 'first', groupId: group ? 'group' : null, characterId: 0,
        characters: [{ name: 'first', chat: 'first', avatar: 'first.png' }], chatMetadata: { variables: { focus: 4 } } };
    const disk = new Map(), savedGroups = [], calls = [];
    const extension_settings = { variables: { global: { count: 5 } } };
    let finish, fail = false;
    const gate = new Promise(resolve => { finish = resolve; });
    const save = async () => {
        const id = ctx.chatId, metadata = structuredClone(ctx.chatMetadata);
        calls.push(id);
        await gate;
        if (!fail) disk.set(id, [{ ...(legacy ? {} : { chat_metadata: metadata }) }]);
    };
    const source = readFileSync(new URL('../variables-panel-save.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
    const { savePanelVariables } = runInNewContext(source + '\n({savePanelVariables})', {
        getContext: () => ctx, extension_settings, PANEL_COPY, structuredClone,
        lodash: { isEqual: (left, right) => isDeepStrictEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right))) },
        saveChat: save, saveGroupChat: save,
        editGroup: async () => { savedGroups.push({ id: ctx.groupId, chat_id: ctx.chatId, chat_metadata: structuredClone(ctx.chatMetadata) }); },
        saveSettings: async () => {}, getRequestHeaders: () => ({}),
        fetch: async (url, options) => ({ ok: true, json: async () => {
            const body = JSON.parse(options.body);
            if (url === '/api/groups/all') return savedGroups;
            if (url === '/api/settings/get') return { settings: JSON.stringify({ extension_settings }) };
            calls.push(body.file_name || body.id);
            return disk.get(body.file_name || body.id) || [];
        } }),
    });
    return { savePanelVariables, calls, disk, finish, fail: value => { fail = value; },
        switchChat() {ctx = { ...ctx, chatId: 'second', characters: [{ name: 'second', chat: 'second', avatar: 'second.png' }], chatMetadata: { variables: { focus: 9 } } };},
    };
}

test('P1: character and supported group saves capture the destination before navigation', async () => {
    for (const options of [{}, { group: true }, { group: true, legacy: true }]) {
        const host = harness(options);
        let complete = false;
        const pending = host.savePanelVariables('character').then(() => { complete = true; });
        assert.deepEqual(host.calls, ['first']);
        host.switchChat(); await Promise.resolve(); assert.equal(complete, false);
        host.finish(); await pending;
        assert.deepEqual(host.calls, ['first', 'first']);
        assert.equal(host.disk.has('second'), false);
    }
});

test('P2: failed persistence is rejected; retry confirms the stored values without reapplying an edit', async () => {
    const host = harness(); host.fail(true); host.finish();
    await assert.rejects(host.savePanelVariables('character'), { message: PANEL_COPY.unconfirmed });
    host.fail(false); await host.savePanelVariables('character');
    assert.equal(host.disk.get('first')[0].chat_metadata.variables.focus, 4);
    await host.savePanelVariables('global');
});
