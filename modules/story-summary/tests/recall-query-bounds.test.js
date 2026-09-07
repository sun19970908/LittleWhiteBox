import test from 'node:test';
import assert from 'node:assert/strict';

import {
    boundRecallEmbeddingSegment,
    RECALL_EMBEDDING_SEGMENT_MAX_CHARS,
} from '../vector/retrieval/recall-query-bounds.js';

test('short recall embedding segments remain unchanged', () => {
    const input = '用户：继续往前走。';
    assert.equal(boundRecallEmbeddingSegment(input), input);
});

test('each oversized recall segment keeps its speaker and recent tail', () => {
    const recentTail = '这是最新状态。';
    const input = `角色：${'A'.repeat(RECALL_EMBEDDING_SEGMENT_MAX_CHARS)}${recentTail}`;
    const bounded = boundRecallEmbeddingSegment(input);

    assert.equal(bounded.length, RECALL_EMBEDDING_SEGMENT_MAX_CHARS);
    assert.ok(bounded.startsWith('角色：…'));
    assert.ok(bounded.endsWith(recentTail));
});

test('tail clipping does not start with a dangling surrogate', () => {
    const bounded = boundRecallEmbeddingSegment('用户：A😀BC', 7);

    assert.equal(bounded, '用户：…BC');
});
