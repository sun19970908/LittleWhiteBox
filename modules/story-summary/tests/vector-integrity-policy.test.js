import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVectorIntegrityIssues } from '../vector/integrity-policy.js';

const decisions = input => buildVectorIntegrityIssues(input).map(({ code, action }) => ({ code, action }));

test('temporary L1 gaps below five floors stay silent', () => {
    assert.deepEqual(buildVectorIntegrityIssues({ chunkFloorGap: 0 }), []);
    assert.deepEqual(buildVectorIntegrityIssues({ chunkFloorGap: 1 }), []);
    assert.deepEqual(buildVectorIntegrityIssues({ chunkFloorGap: 4 }), []);
});

test('an L1 gap of five floors warns', () => {
    assert.deepEqual(
        decisions({ chunkFloorGap: 5 }),
        [{ code: 'l1_gap', action: 'fill' }],
    );
});

test('fingerprint and unrepaired event-vector failures still warn immediately', () => {
    assert.deepEqual(
        decisions({
            fingerprintMismatch: true,
            chunkFloorGap: 2,
            missingEventVectorCount: 3,
        }),
        [
            { code: 'fingerprint_mismatch', action: 'rebuild' },
            { code: 'event_vectors_missing', action: 'fill' },
        ],
    );
});

test('temporary anchor and vector gaps below five floors stay silent independently', () => {
    for (const count of [0, 1, 4]) {
        assert.deepEqual(decisions({ incompleteL0AnchorFloorCount: count }), []);
        assert.deepEqual(decisions({ missingL0VectorFloorCount: count }), []);
    }
    // The two counts can refer to the same floors; adding them invents a larger gap.
    assert.deepEqual(decisions({ incompleteL0AnchorFloorCount: 3, missingL0VectorFloorCount: 3 }), []);
});

test('unfinished anchor extraction directs users to anchors, not vector repair', () => {
    assert.deepEqual(decisions({ incompleteL0AnchorFloorCount: 5 }), [
        { code: 'l0_gap', action: 'extract' },
    ]);
});

test('missing or stale vectors never imply missing anchor text', () => {
    assert.deepEqual(decisions({ missingL0VectorFloorCount: 5 }), [
        { code: 'l0_vectors_missing', action: 'fill' },
    ]);
    assert.deepEqual(decisions({ cacheInconsistent: true, cacheRepairable: true, missingL0VectorFloorCount: 5 }), [
        { code: 'cache_inconsistent', action: 'fill' },
        { code: 'l0_vectors_missing', action: 'fill' },
    ]);
});

test('simultaneous anchor and vector gaps retain both repair destinations', () => {
    assert.deepEqual(decisions({ incompleteL0AnchorFloorCount: 5, missingL0VectorFloorCount: 5 }), [
        { code: 'l0_gap', action: 'extract' },
        { code: 'l0_vectors_missing', action: 'fill' },
    ]);
});

test('cache repairability determines the action even when the progress watermark is current', () => {
    for (const cacheRepairable of [false, true]) {
        assert.deepEqual(decisions({ cacheInconsistent: true, cacheRepairable, chunkFloorGap: 0, incompleteL0AnchorFloorCount: 1 }), [
            { code: 'cache_inconsistent', action: cacheRepairable ? 'fill' : 'rebuild' },
        ]);
    }
});
