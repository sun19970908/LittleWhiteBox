import assert from 'node:assert/strict';
import test from 'node:test';
import { tryConsumeWholeItem } from '../generate/token-budget.js';

test('positive remaining space admits the complete boundary item and closes the ledger', () => {
    const budget = { used: 3847, max: 4000 };
    assert.equal(tryConsumeWholeItem(185, budget), true);
    assert.equal(budget.used, 4032);
    assert.equal(tryConsumeWholeItem(1, budget), false);
    assert.equal(budget.used, 4032);
});

test('zero, exactly full, and already exceeded budgets admit nothing', () => {
    for (const budget of [{ used: 0, max: 0 }, { used: 12, max: 12 }, { used: 13, max: 12 }]) {
        const before = { ...budget };
        assert.equal(tryConsumeWholeItem(1, budget), false);
        assert.deepEqual(budget, before);
    }
});

test('nested quotas charge atomically and only their closed lane stops', () => {
    const total = { used: 0, max: 20 };
    const lane = { used: 0, max: 8 };
    assert.equal(tryConsumeWholeItem(9, total, lane), true);
    assert.equal(tryConsumeWholeItem(2, total, lane), false);
    assert.deepEqual(total, { used: 9, max: 20 });
    assert.deepEqual(lane, { used: 9, max: 8 });
    assert.equal(tryConsumeWholeItem(12, total), true);
    assert.equal(tryConsumeWholeItem(1, total), false);
    assert.equal(total.used, 21);
});
