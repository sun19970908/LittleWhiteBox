import assert from 'node:assert/strict';
import test from 'node:test';
import { packCausalEvidence } from '../generate/causal-evidence-packing.js';

function fixture() {
    const owners = ['a', 'b'].map(id => ({
        label: id, event: { id, causedBy: [1, 2, 3].map(n => `${id}${n}`) },
    }));
    const causes = new Map(owners.flatMap(owner => owner.event.causedBy.map(id => (
        [id, { event: { id, summary: id } }]
    ))));
    return { owners, causes };
}

test('causal owner and shared quotas admit their boundary cause, then stop that lane', () => {
    const { owners, causes } = fixture();
    const budget = { used: 0, max: 1000 };
    const result = packCausalEvidence(owners, causes, budget, () => 75);
    assert.deepEqual([...result.byEvent].map(([id, items]) => [id, items.map(item => item.causeId)]), [
        ['a', ['a1', 'a2']], ['b', ['b1', 'b2']],
    ]);
    assert.equal(result.stats.tokens, 300);
    assert.equal(budget.used, result.stats.tokens);
    assert.ok(budget.used - 75 < result.stats.maxTokens);
});

test('a cause crossing the outer pool closes all owners, including later shorter references', () => {
    const { owners, causes } = fixture();
    const budget = { used: 995, max: 1000 };
    const result = packCausalEvidence(owners, causes, budget, () => 20);
    assert.equal(result.stats.links, 1);
    assert.equal(budget.used, 1015);
    assert.deepEqual([...result.byEvent.keys()], ['a']);
});
