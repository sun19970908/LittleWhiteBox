import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Text } from '../lib/run-store.mjs';
import { parseNaturalPositions } from '../lib/natural-positions.mjs';

const messages = [
    { is_user: false, mes: 'Earlier history' },
    { is_user: true, mes: 'First user turn' },
    { is_user: false, mes: 'Role response' },
    { is_user: true, mes: 'Current user turn' },
];
const row = floor => ({ schemaVersion: 1, track: 'natural-source-only', id: `turn-${floor}`,
    query: { kind: 'verbatim-user', floor, text: messages[floor].mes,
        sha256: sha256Text(messages[floor].mes) }, historyThroughFloor: floor - 1 });
const lines = rows => rows.map(item => JSON.stringify(item)).join('\n');

test('source-only capture covers all original USER boundaries without supplying quality labels', () => {
    const positions = parseNaturalPositions(lines([row(1), row(3)]), messages, 2);
    assert.deepEqual(positions.map(item => item.atFloor), [1, 3]);
    assert.ok(positions.every(item => !Object.hasOwn(item, 'evidence') && !Object.hasOwn(item, 'expectedAnswer')));
});

test('cannot skip, reorder, invent evidence, or change the original message', () => {
    for (const rows of [
        [row(3)], [row(3), row(1)],
        [row(1), { ...row(3), evidence: { requiredAll: [0] } }],
        [row(1), { ...row(3), query: { ...row(3).query, text: 'Changed' } }],
    ]) assert.throws(() => parseNaturalPositions(lines(rows), messages, 2));
});
