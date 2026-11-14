import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuleRefresh } from '../definition/refresh.js';
import { CARD_EXTENSION } from '../definition/format.js';
import { equipmentExample } from '../definition/example.js';

// O5: late reads may not replace another card or a newer local rule save, and
// cancellation/read failure stays a failure (wrong-card or silent rule loss).
test('O5: late refresh, concurrent save, cancellation and failed reads preserve current data', async () => {
    for (const scenario of ['switch', 'save', 'cancel', 'failure']) {
        const original = JSON.stringify(equipmentExample());
        const current = { avatar: 'a.png', data: { extensions: { [CARD_EXTENSION]: original } } };
        const next = equipmentExample(); next.definition.name = 'remote';
        let finish!: () => void, changed = 0;
        const wait = new Promise<void>(resolve => {finish = resolve;});
        const controller = new AbortController();
        const refresh = createRuleRefresh({ current: () => current, changed: async () => {changed++;}, read: async () => {
            await wait;
            if (scenario === 'failure') {throw new Error('network');}
            return { avatar: 'a.png', data: { extensions: { [CARD_EXTENSION]: JSON.stringify(next) } } };
        } });
        const pending = refresh({ avatar: 'a.png', signal: controller.signal });
        if (scenario === 'switch') {current.avatar = 'b.png';}
        if (scenario === 'save') {current.data.extensions[CARD_EXTENSION] = JSON.stringify({ ...next, functions: { local: '() => 1' } });}
        if (scenario === 'cancel') {controller.abort();}
        const expected = structuredClone(current);
        const rejected = assert.rejects(pending);
        finish(); await rejected;
        assert.deepEqual(current, expected); assert.equal(changed, 0);
    }
});
