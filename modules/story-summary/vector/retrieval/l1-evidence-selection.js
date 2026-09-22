import { toFloat32 } from '../runtime/scoring.js';
import { chunkMatchesTemporalCarrier, getTemporalProtectionLimit, parseEventRange,
    TEMPORAL_PROTECTION_POLICY } from './temporal-turn-carrier.js';

// Similarity is an eligibility floor; MMR only diversifies eligible passages.
export const L1_EVIDENCE_POLICY = Object.freeze({
    perLane: 3, shortlistPerSource: 32, minSimilarity: 0.50, lambda: 0.85, rrfK: 60,
    admissionBatchSize: 3,
});

function unitVector(value) {
    const vector = toFloat32(value);
    if (!vector?.length) return null;
    let norm = 0;
    for (const n of vector) {
        if (!Number.isFinite(n)) return null;
        norm += n * n;
    }
    if (!norm) return null;
    const scale = Math.sqrt(norm);
    const unit = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) unit[i] = vector[i] / scale;
    return unit;
}

function dot(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let score = 0;
    for (let i = 0; i < a.length; i++) score += a[i] * b[i];
    return score;
}

function ranked(rows, getScore) {
    return rows.sort((a, b) => getScore(b) - getScore(a)
        || a.chunk.floor - b.chunk.floor || a.chunk.chunkIdx - b.chunk.chunkIdx);
}

function prepareSource(rows) {
    const policy = L1_EVIDENCE_POLICY;
    const queryRows = ranked(rows.filter(row => row.queryScore >= policy.minSimilarity), row => row.queryScore);
    const lexicalRows = ranked(rows.filter(row => row.lexicalScore > 0), row => row.lexicalScore);
    for (const source of [queryRows, lexicalRows]) {
        for (const [index, row] of source.entries()) {
            row.conversationScore += (policy.rrfK + 1) / (policy.rrfK + index + 1) / 2;
        }
    }
    const conversationRows = ranked(rows.filter(row => row.conversationScore > 0), row => row.conversationScore);
    const temporalRows = rows.filter(row => row.temporal).sort((a, b) => (
        b.conversationScore - a.conversationScore || b.queryScore - a.queryScore
        || a.chunk.floor - b.chunk.floor || a.chunk.chunkIdx - b.chunk.chunkIdx
    ));
    return { queryRows, conversationRows, lexicalRows, temporalRows, selected: [] };
}

function shortlist(sources, isAvailable) {
    const candidates = new Map();
    for (const source of sources) {
        let count = 0;
        for (const row of source) {
            if (!isAvailable(row)) continue;
            candidates.set(row.chunk.chunkId, row);
            if (++count >= L1_EVIDENCE_POLICY.shortlistPerSource) break;
        }
    }
    return [...candidates.values()];
}

async function pickConversationPassage(selection, round, selectedIds, isProtected, checkpoint, stats) {
    const available = row => !selectedIds.has(row.chunk.chunkId);
    const protectedAvailable = row => available(row) && isProtected(row);
    // Exact-time winners bypass the dense shortlist, not the protection caps.
    if (round === 0) {
        const winner = selection.temporalRows.find(protectedAvailable);
        if (winner) return winner;
    }
    const candidates = [...new Map([
        ...shortlist([selection.conversationRows, selection.lexicalRows], available),
        ...shortlist([selection.temporalRows], protectedAvailable),
    ].map(row => [row.chunk.chunkId, row])).values()];
    let best = null;
    let bestScore = -Infinity;
    if (round > 0) stats.maxMmrCandidates = Math.max(stats.maxMmrCandidates, candidates.length);
    for (const [index, row] of candidates.entries()) {
        if (index % 32 === 0) await checkpoint();
        const relevance = row.conversationScore;
        let redundancy = 0;
        if (round > 0) {
            for (const other of selection.selected) {
                redundancy = Math.max(redundancy, dot(row.vector, other.vector));
                stats.mmrComparisons++;
            }
        }
        const score = L1_EVIDENCE_POLICY.lambda * relevance - (1 - L1_EVIDENCE_POLICY.lambda) * redundancy;
        if (score > bestScore) { best = row; bestScore = score; }
    }
    return best;
}

// Query ranking spans all retrieved sources. Floor ranking preserves the first
// rerank's order; conversation ranking adds lexical support and source diversity.
function orderForAdmission(items, queryCandidates, queryLimit) {
    const lanes = [
        { items: queryCandidates, limit: queryLimit },
        { items: items.filter(item => item.evidenceLane === 'floor'), limit: Infinity },
        { items: items.filter(item => item.evidenceLane === 'conversation'), limit: Infinity },
    ].map(lane => ({ ...lane, cursor: 0, emitted: 0 }));
    const seen = new Set();
    const ordered = [];
    while (lanes.some(lane => lane.cursor < lane.items.length && lane.emitted < lane.limit)) {
        for (const lane of lanes) {
            let added = 0;
            while (lane.cursor < lane.items.length && lane.emitted < lane.limit
                && added < L1_EVIDENCE_POLICY.admissionBatchSize) {
                const item = lane.items[lane.cursor++];
                if (seen.has(item.chunkId)) continue;
                seen.add(item.chunkId);
                ordered.push(item);
                lane.emitted++;
                added++;
            }
        }
    }
    return ordered;
}

function evidenceItem(row, evidenceLane, temporal) {
    return { ...row.chunk, evidenceLane,
        queryScore: row.queryScore, lexicalScore: row.lexicalScore,
        _directEvidenceTemporalMatch: row.temporal,
        _directEvidenceTemporalCarrier: temporal,
        _directEvidencePassedMinScore: row.queryScore >= L1_EVIDENCE_POLICY.minSimilarity || row.lexicalScore > 0 };
}

/** Retrieval eligibility is independent of display ownership. No API or storage writes. */
export async function selectL1Evidence(parents, data, options = {}) {
    const query = unitVector(options.queryVector);
    const lexical = new Map((options.lexicalScores || []).map(item => [item.chunkId, Number(item.score) || 0]));
    const rowsByFloor = new Map();
    const selectedIds = new Set();
    const parentIds = new Set();
    const temporalWinners = new Map();
    const items = [];
    const floorSelections = [];
    const stats = { parents: 0, floors: 0, sourceCandidates: 0, vectorHits: 0, missingVectors: 0,
        queryItems: 0, floorItems: 0, conversationItems: 0, lexicalItems: 0,
        temporalCandidates: 0, temporalFloorWinners: 0, temporalProtectedCandidates: 0,
        maxMmrCandidates: 0, mmrComparisons: 0 };
    const check = () => {
        options.signal?.throwIfAborted();
        if (options.isCurrent && !options.isCurrent()) throw new DOMException('Recall session released', 'AbortError');
    };
    let sliceStarted = performance.now();
    const checkpoint = async () => {
        if (performance.now() - sliceStarted >= 8) {
            await new Promise(resolve => setTimeout(resolve, 0));
            sliceStarted = performance.now();
        }
        check();
    };
    const ranges = [];
    for (const parent of parents || []) {
        check();
        const event = parent?.event;
        const range = parseEventRange(event?.summary);
        if (!event?.id || parentIds.has(event.id) || !range || range.end < range.start) continue;
        parentIds.add(event.id);
        stats.parents++;
        ranges.push(range);
    }
    const sourceFloors = new Set((options.sourceTurns || []).flatMap(turn => (
        [turn.floor, turn.contextFloor].filter(Number.isInteger)
    )));
    let scanned = 0;
    for (const [floor, chunks] of data.chunksByFloor) {
        await checkpoint();
        if (Number.isInteger(options.hiddenThrough) && floor > options.hiddenThrough) continue;
        if (!sourceFloors.has(floor) && !ranges.some(range => floor >= range.start && floor <= range.end)) continue;
        const rows = [];
        for (const chunk of chunks) {
            if (!String(chunk.text || '').trim()) continue;
            const vector = unitVector(data.chunkVectorsById.get(chunk.chunkId)?.vector);
            const usable = vector && (!query || vector.length === query.length) ? vector : null;
            stats[usable ? 'vectorHits' : 'missingVectors']++;
            const temporal = chunkMatchesTemporalCarrier(chunk, options.temporalCarrier);
            if (temporal) stats.temporalCandidates++;
            rows.push({ chunk, vector: usable, queryScore: dot(query, usable),
                lexicalScore: lexical.get(chunk.chunkId) || 0, temporal, conversationScore: 0 });
            if (++scanned % 32 === 0) await checkpoint();
        }
        rowsByFloor.set(floor, rows);
    }
    const allRows = [...rowsByFloor.values()].flat();
    const global = prepareSource(allRows);
    for (const row of global.temporalRows) {
        if (!temporalWinners.has(row.chunk.floor)) temporalWinners.set(row.chunk.floor, row.chunk.chunkId);
    }
    const selectionFor = rows => ({
        queryRows: ranked(rows.filter(row => row.queryScore >= L1_EVIDENCE_POLICY.minSimilarity), row => row.queryScore),
        lexicalRows: ranked(rows.filter(row => row.lexicalScore > 0), row => row.lexicalScore),
        conversationRows: ranked(rows.filter(row => row.conversationScore > 0), row => row.conversationScore),
        temporalRows: global.temporalRows.filter(row => rows.includes(row)), selected: [],
    });
    const seenTurns = new Set();
    for (const turn of options.sourceTurns || []) {
        if (seenTurns.has(turn.floor)) continue;
        seenTurns.add(turn.floor);
        floorSelections.push(selectionFor([...(rowsByFloor.get(turn.floor) || []),
            ...(rowsByFloor.get(turn.contextFloor) || [])]));
    }
    const conversationSelections = [...rowsByFloor.values()].map(selectionFor)
        .sort((a, b) => (b.conversationRows[0]?.conversationScore || 0) - (a.conversationRows[0]?.conversationScore || 0)
            || (b.queryRows[0]?.queryScore || 0) - (a.queryRows[0]?.queryScore || 0)
            || (a.queryRows[0]?.chunk.floor || 0) - (b.queryRows[0]?.chunk.floor || 0));
    const temporalCap = getTemporalProtectionLimit(Math.max(stats.parents, floorSelections.length) * L1_EVIDENCE_POLICY.perLane * 2,
        TEMPORAL_PROTECTION_POLICY.maxCandidateShare);
    const isProtected = row => temporalWinners.get(row.chunk.floor) === row.chunk.chunkId
        && stats.temporalProtectedCandidates < temporalCap;
    const append = (row, lane) => {
        const temporal = isProtected(row);
        if (temporal) stats.temporalProtectedCandidates++;
        selectedIds.add(row.chunk.chunkId);
        items.push(evidenceItem(row, lane, temporal));
    };
    // The first rerank ranks whole USER/AI turns. Preserve that order for each
    // turn's small query-ranked set; do not demote its second passage behind
    // every other turn's first passage. Diversity belongs to the other lanes.
    for (const selection of floorSelections) {
        await checkpoint();
        const rows = ranked([...new Set([...selection.queryRows, ...selection.lexicalRows])], row => row.queryScore);
        for (const row of rows.filter(row => !selectedIds.has(row.chunk.chunkId)).slice(0, L1_EVIDENCE_POLICY.perLane)) {
            append(row, 'floor');
        }
    }
    for (let round = 0; round < L1_EVIDENCE_POLICY.perLane; round++) {
        for (const selection of conversationSelections) {
            const row = await pickConversationPassage(selection, round, selectedIds, isProtected, checkpoint, stats);
            if (!row) continue;
            selection.selected.push(row);
            append(row, 'conversation');
        }
    }
    const selectedById = new Map(items.map(item => [item.chunkId, item]));
    const queryCandidates = global.queryRows.map(row => ({
        ...(selectedById.get(row.chunk.chunkId) || evidenceItem(row, 'query', false)), evidenceLane: 'query',
    }));
    const ordered = orderForAdmission(items, queryCandidates, rowsByFloor.size * L1_EVIDENCE_POLICY.perLane);
    stats.temporalFloorWinners = temporalWinners.size;
    stats.floors = rowsByFloor.size;
    stats.sourceCandidates = allRows.length;
    stats.queryItems = ordered.filter(item => item.evidenceLane === 'query').length;
    stats.floorItems = ordered.filter(item => item.evidenceLane === 'floor').length;
    stats.conversationItems = ordered.filter(item => item.evidenceLane === 'conversation').length;
    stats.lexicalItems = ordered.filter(item => item.lexicalScore > 0).length;
    stats.candidates = stats.relevantItems = ordered.length;
    check();
    return { items: ordered, stats,
        status: stats.missingVectors ? 'partial-vectors' : 'applied' };
}
