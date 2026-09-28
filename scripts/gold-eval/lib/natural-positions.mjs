// Source-only positions identify real USER boundaries without asserting a memory need.
// Semantic requirements belong to the independent review, not the capture runner.
import { sha256Text } from './run-store.mjs';

export function parseNaturalPositions(text, messages, firstDisplayFloor) {
    if (!Number.isInteger(firstDisplayFloor) || firstDisplayFloor < 1) {
        throw new Error('Source-only firstDisplayFloor must be a positive integer');
    }
    const rows = String(text || '').split(/\r?\n/).filter(Boolean).map((line, index) => {
        let row;
        try { row = JSON.parse(line); }
        catch { throw new Error(`Invalid source-only position at line ${index + 1}`); }
        const floor = row?.query?.floor;
        const message = messages[floor];
        if (row?.schemaVersion !== 1 || row?.track !== 'natural-source-only'
            || row?.query?.kind !== 'verbatim-user' || !Number.isInteger(floor)
            || !message?.is_user || row.query.text !== message.mes
            || row.query.sha256 !== sha256Text(message.mes)
            || row.historyThroughFloor !== floor - 1 || typeof row.id !== 'string' || !row.id
            || Object.hasOwn(row, 'evidence') || Object.hasOwn(row, 'expectedAnswer')) {
            throw new Error(`Source-only position is not bound to the original USER message: line ${index + 1}`);
        }
        return row;
    });
    const expected = messages.flatMap((message, floor) =>
        message.is_user && floor + 1 >= firstDisplayFloor ? [floor] : []);
    if (rows.length !== expected.length || rows.some((row, index) => row.query.floor !== expected[index])
        || new Set(rows.map(row => row.id)).size !== rows.length) {
        throw new Error('Source-only positions must cover every natural USER position in source order');
    }
    return rows.map(row => ({ ...row, atFloor: row.query.floor, queryText: row.query.text }));
}
