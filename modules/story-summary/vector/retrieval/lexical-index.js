import MiniSearch from '../../../../libs/minisearch.mjs';
import { getContext } from '../../../../../../../extensions.js';
import { getSummaryStore } from '../../data/store.js';
import { getAllChunks } from '../storage/chunk-store.js';
import { lexicalIndexTable } from '../../data/db.js';
import { xbLog } from '../../../../core/debug-core.js';
import { tokenizeForIndex } from '../utils/tokenizer.js';

const MODULE_ID = 'lexical-index';

// In-memory index cache
let cachedIndex = null;
let cachedChatId = null;
let cachedFingerprint = null;
let buildGeneration = 0;
let activeBuild = null;

// floor -> chunk doc ids (L1 only)
let floorDocIds = new Map();
// floor -> text signature (for snapshot diff on refresh)
let floorSigs = new Map();
// event id -> text signature (for snapshot diff on refresh)
let eventSigs = new Map();

// IDF stats over lexical docs (L1 chunks + L2 events)
let termDfMap = new Map();
let docTokenSets = new Map(); // docId -> Set<token>
let lexicalDocCount = 0;

const IDF_MIN = 1.0;
const IDF_MAX = 4.0;
const BUILD_BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────────────────────
// 持久化快照（页面刷新后避免 40s 全量重建）
//
// 策略：MiniSearch 索引整体序列化进 IndexedDB（lexicalIndex 表），每次增量
// 写入时按“累计脏变更 ≥10 或空闲防抖”触发重存。刷新后 getLexicalIndex() 缓存
// miss 时：先读快照，用 fingerprint 快速判定未过期则直接反序列化（秒级）；
// 过期则对 楼层/事件 签名做 diff，只对新增/变更的部分分词增量 addAll/discard，
// 而不是全量重建。真正不可预测的全量分词只在“无快照”（首启/表被清）时发生。
// ─────────────────────────────────────────────────────────────────────────────

// 词法索引结构/分词器版本。tokenizer 规则、停用词、索引结构任一变更时 +1，
// 会让所有已存快照失效回退全量重建（安全网）。
const LEXICAL_INDEX_VERSION = 1;

// 快照重存触发：累计脏变更达到该值，或空闲防抖到期，即触发保存。
const SNAPSHOT_DIRTY_THRESHOLD = 10;
const SNAPSHOT_SAVE_IDLE_MS = 3000;
// 快速连发写入时两次保存的最小间隔，避免写风暴（每次全量序列化 ~200-500ms）。
const SNAPSHOT_SAVE_MIN_INTERVAL_MS = 5000;

let snapshotDirtyCount = 0;
let snapshotSaveTimer = null;
let lastSnapshotSaveAt = 0;
let persistenceDisabled = false;

/**
 * MiniSearch 构造/反序列化必须使用同一组 options。返回新对象避免 MiniSearch
 * 构造器原地改写共享引用。
 */
function createMiniSearchOptions() {
    return {
        fields: ['text'],
        storeFields: ['type', 'floor'],
        idField: 'id',
        searchOptions: {
            boost: { text: 1 },
            fuzzy: 0.2,
            prefix: true,
        },
        tokenize: tokenizeForIndex,
    };
}

function cleanSummary(summary) {
    return String(summary || '')
        .replace(/\s*\(#\d+(?:-\d+)?\)\s*$/, '')
        .trim();
}

function fnv1a32(input, seed = 0x811C9DC5) {
    let hash = seed >>> 0;
    const text = String(input || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function compareDocKeys(a, b) {
    const ka = `${a?.type || ''}:${a?.id || ''}`;
    const kb = `${b?.type || ''}:${b?.id || ''}`;
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
}

/**
 * 楼层文本签名：对该楼层所有 chunk（按 chunkId 排序）的 chunkId+text 做滚动哈希。
 * 用于刷新时判断该楼层是否变化。
 */
function hashFloorChunks(chunkList) {
    const sorted = [...(chunkList || [])].sort((a, b) => String(a?.chunkId || '').localeCompare(String(b?.chunkId || '')));
    let hash = 0x811C9DC5;
    for (const c of sorted) {
        hash = fnv1a32(`${c?.chunkId || ''}\u001F${c?.text || ''}\u001E`, hash);
    }
    return `${sorted.length}:${(hash >>> 0).toString(16)}`;
}

function hashText(text) {
    return fnv1a32(String(text || ''));
}

function computeFingerprintFromDocs(docs) {
    const normalizedDocs = Array.isArray(docs) ? [...docs].sort(compareDocKeys) : [];
    let hash = 0x811C9DC5;

    for (const doc of normalizedDocs) {
        const payload = `${doc?.type || ''}\u001F${doc?.id || ''}\u001F${doc?.floor ?? ''}\u001F${doc?.text || ''}\u001E`;
        hash = fnv1a32(payload, hash);
    }

    return `${normalizedDocs.length}:${(hash >>> 0).toString(16)}`;
}

function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function normalizeTerm(term) {
    return String(term || '').trim().toLowerCase();
}

function computeIdfFromDf(df, docCount) {
    if (!docCount || docCount <= 0) return 1;
    const raw = Math.log((docCount + 1) / ((df || 0) + 1)) + 1;
    return clamp(raw, IDF_MIN, IDF_MAX);
}

function computeIdf(term) {
    const t = normalizeTerm(term);
    if (!t || lexicalDocCount <= 0) return 1;
    return computeIdfFromDf(termDfMap.get(t) || 0, lexicalDocCount);
}

function extractUniqueTokens(text) {
    return new Set(tokenizeForIndex(String(text || '')).map(normalizeTerm).filter(Boolean));
}

function clearIdfState() {
    termDfMap = new Map();
    docTokenSets = new Map();
    lexicalDocCount = 0;
}

function removeDocumentIdf(docId) {
    const id = String(docId || '');
    if (!id) return;

    const tokens = docTokenSets.get(id);
    if (!tokens) return;

    for (const token of tokens) {
        const current = termDfMap.get(token) || 0;
        if (current <= 1) {
            termDfMap.delete(token);
        } else {
            termDfMap.set(token, current - 1);
        }
    }

    docTokenSets.delete(id);
    lexicalDocCount = Math.max(0, lexicalDocCount - 1);
}

function addDocumentIdf(docId, text) {
    const id = String(docId || '');
    if (!id) return;

    // Replace semantics: remove old token set first if this id already exists.
    removeDocumentIdf(id);

    const tokens = extractUniqueTokens(text);
    docTokenSets.set(id, tokens);
    lexicalDocCount += 1;

    for (const token of tokens) {
        termDfMap.set(token, (termDfMap.get(token) || 0) + 1);
    }
}

function rebuildIdfFromDocs(docs) {
    clearIdfState();
    for (const doc of docs || []) {
        const id = String(doc?.id || '');
        const text = String(doc?.text || '');
        if (!id || !text.trim()) continue;
        addDocumentIdf(id, text);
    }
}

function buildEventDoc(ev) {
    if (!ev?.id) return null;

    const parts = [];
    if (ev.title) parts.push(ev.title);
    if (ev.participants?.length) parts.push(ev.participants.join(' '));

    const summary = cleanSummary(ev.summary);
    if (summary) parts.push(summary);

    const text = parts.join(' ').trim();
    if (!text) return null;

    return {
        id: ev.id,
        type: 'event',
        floor: null,
        text,
    };
}

function collectDocuments(chunks, events) {
    const docs = [];
    const nextFloorDocIds = new Map();
    const nextFloorSigs = new Map();
    const nextEventSigs = new Map();
    const floorChunks = new Map();

    for (const chunk of chunks || []) {
        if (!chunk?.chunkId || !chunk.text) continue;

        const floor = chunk.floor ?? -1;
        docs.push({
            id: chunk.chunkId,
            type: 'chunk',
            floor,
            text: chunk.text,
        });

        if (floor >= 0) {
            if (!nextFloorDocIds.has(floor)) nextFloorDocIds.set(floor, []);
            nextFloorDocIds.get(floor).push(chunk.chunkId);
            if (!floorChunks.has(floor)) floorChunks.set(floor, []);
            floorChunks.get(floor).push(chunk);
        }
    }

    for (const [floor, chunkList] of floorChunks) {
        nextFloorSigs.set(floor, hashFloorChunks(chunkList));
    }

    for (const ev of events || []) {
        const doc = buildEventDoc(ev);
        if (doc) {
            docs.push(doc);
            nextEventSigs.set(doc.id, hashText(doc.text));
        }
    }

    return { docs, floorDocIds: nextFloorDocIds, floorSigs: nextFloorSigs, eventSigs: nextEventSigs };
}

async function buildIndexAsync(docs) {
    const T0 = performance.now();

    const index = new MiniSearch(createMiniSearchOptions());

    if (!docs.length) return index;

    for (let i = 0; i < docs.length; i += BUILD_BATCH_SIZE) {
        const batch = docs.slice(i, i + BUILD_BATCH_SIZE);
        index.addAll(batch);

        if (i + BUILD_BATCH_SIZE < docs.length) {
            await yieldToMain();
        }
    }

    const elapsed = Math.round(performance.now() - T0);
    xbLog.info(MODULE_ID, `Index built: ${docs.length} docs (${elapsed}ms)`);
    return index;
}

/**
 * 批量 addAll，批间让出主线程，避免大 diff 阻塞。
 */
async function addDocsBatched(index, docs) {
    if (!index || !docs?.length) return;
    for (let i = 0; i < docs.length; i += BUILD_BATCH_SIZE) {
        const batch = docs.slice(i, i + BUILD_BATCH_SIZE);
        index.addAll(batch);
        if (i + BUILD_BATCH_SIZE < docs.length) {
            await yieldToMain();
        }
    }
}

/**
 * @typedef {object} LexicalSearchResult
 * @property {string[]} atomIds - Reserved for backward compatibility (currently empty).
 * @property {Set<number>} atomFloors - Reserved for backward compatibility (currently empty).
 * @property {string[]} chunkIds - Matched L1 chunk ids sorted by weighted lexical score.
 * @property {Set<number>} chunkFloors - Floor ids covered by matched chunks.
 * @property {string[]} eventIds - Matched L2 event ids sorted by weighted lexical score.
 * @property {object[]} chunkScores - Weighted lexical scores for matched chunks.
 * @property {boolean} idfEnabled - Whether IDF stats are available for weighting.
 * @property {number} idfDocCount - Number of lexical docs used to compute IDF.
 * @property {Array<{term:string,idf:number}>} topIdfTerms - Top query terms by IDF.
 * @property {string[]} queryTerms - Normalized query terms actually searched.
 * @property {Record<string, Array<{floor:number, weightedScore:number, chunkId:string}>>} termFloorHits - Chunk-floor hits by term.
 * @property {Array<{floor:number, score:number, hitTermsCount:number}>} floorLexScores - Aggregated lexical floor scores (debug).
 * @property {number} termSearches - Number of per-term MiniSearch queries executed.
 * @property {number} searchTime - Total lexical search time in milliseconds.
 */

/**
 * Search lexical index by terms, using per-term MiniSearch and IDF-weighted score aggregation.
 * This keeps existing outputs compatible while adding observability fields.
 *
 * @param {MiniSearch} index
 * @param {string[]} terms
 * @returns {LexicalSearchResult}
 */
export function searchLexicalIndex(index, terms) {
    const T0 = performance.now();

    const result = {
        atomIds: [],
        atomFloors: new Set(),
        chunkIds: [],
        chunkFloors: new Set(),
        eventIds: [],
        chunkScores: [],
        idfEnabled: lexicalDocCount > 0,
        idfDocCount: lexicalDocCount,
        topIdfTerms: [],
        queryTerms: [],
        termFloorHits: {},
        floorLexScores: [],
        termSearches: 0,
        searchTime: 0,
    };

    if (!index || !terms?.length) {
        result.searchTime = Math.round(performance.now() - T0);
        return result;
    }

    const queryTerms = Array.from(new Set((terms || []).map(normalizeTerm).filter(Boolean)));
    result.queryTerms = [...queryTerms];
    const weightedScores = new Map(); // docId -> score
    const hitMeta = new Map(); // docId -> { type, floor }
    const idfPairs = [];
    const termFloorHits = new Map(); // term -> [{ floor, weightedScore, chunkId }]
    const floorLexAgg = new Map(); // floor -> { score, terms:Set<string> }

    for (const term of queryTerms) {
        const idf = computeIdf(term);
        idfPairs.push({ term, idf });

        let hits = [];
        try {
            hits = index.search(term, {
                boost: { text: 1 },
                fuzzy: 0.2,
                prefix: true,
                combineWith: 'OR',
                tokenize: tokenizeForIndex,
            });
        } catch (e) {
            xbLog.warn(MODULE_ID, `Lexical term search failed: ${term}`, e);
            continue;
        }

        result.termSearches += 1;

        for (const hit of hits) {
            const id = String(hit.id || '');
            if (!id) continue;

            const weighted = (hit.score || 0) * idf;
            weightedScores.set(id, (weightedScores.get(id) || 0) + weighted);

            if (!hitMeta.has(id)) {
                hitMeta.set(id, {
                    type: hit.type,
                    floor: hit.floor,
                });
            }

            if (hit.type === 'chunk' && typeof hit.floor === 'number' && hit.floor >= 0) {
                if (!termFloorHits.has(term)) termFloorHits.set(term, []);
                termFloorHits.get(term).push({
                    floor: hit.floor,
                    weightedScore: weighted,
                    chunkId: id,
                });

                const floorAgg = floorLexAgg.get(hit.floor) || { score: 0, terms: new Set() };
                floorAgg.score += weighted;
                floorAgg.terms.add(term);
                floorLexAgg.set(hit.floor, floorAgg);
            }
        }
    }

    idfPairs.sort((a, b) => b.idf - a.idf);
    result.topIdfTerms = idfPairs.slice(0, 5);
    result.termFloorHits = Object.fromEntries(
        [...termFloorHits.entries()].map(([term, hits]) => [term, hits]),
    );
    result.floorLexScores = [...floorLexAgg.entries()]
        .map(([floor, info]) => ({
            floor,
            score: Number(info.score.toFixed(6)),
            hitTermsCount: info.terms.size,
        }))
        .sort((a, b) => b.score - a.score);

    const sortedHits = Array.from(weightedScores.entries())
        .sort((a, b) => b[1] - a[1]);

    for (const [id, score] of sortedHits) {
        const meta = hitMeta.get(id);
        if (!meta) continue;

        if (meta.type === 'chunk') {
            result.chunkIds.push(id);
            result.chunkScores.push({ chunkId: id, score });
            if (typeof meta.floor === 'number' && meta.floor >= 0) {
                result.chunkFloors.add(meta.floor);
            }
            continue;
        }

        if (meta.type === 'event') {
            result.eventIds.push(id);
        }
    }

    result.searchTime = Math.round(performance.now() - T0);

    xbLog.info(
        MODULE_ID,
        `Lexical search terms=[${queryTerms.slice(0, 5).join(',')}] chunks=${result.chunkIds.length} events=${result.eventIds.length} termSearches=${result.termSearches} (${result.searchTime}ms)`,
    );

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 持久化快照（IndexedDB lexicalIndex 表）
// ═══════════════════════════════════════════════════════════════════════════

async function loadSnapshot(chatId) {
    try {
        const snap = await lexicalIndexTable.get(chatId);
        if (!snap) return null;
        if (snap.version !== LEXICAL_INDEX_VERSION) return null;
        return {
            fingerprint: snap.fingerprint,
            indexJson: snap.indexJson,
            termDfMap: new Map(Object.entries(snap.termDfMap || {})),
            lexicalDocCount: Number(snap.lexicalDocCount || 0),
            floorDocs: snap.floorDocs || {},
            eventDocs: snap.eventDocs || {},
        };
    } catch (e) {
        xbLog.warn(MODULE_ID, 'Failed to load lexical snapshot', e);
        return null;
    }
}

function buildSnapshotPayload(chatId, indexJson) {
    const floorDocs = {};
    for (const [floor, sig] of floorSigs) {
        floorDocs[floor] = { sig, docIds: floorDocIds.get(floor) || [] };
    }
    const eventDocs = {};
    for (const [id, sig] of eventSigs) {
        eventDocs[id] = sig;
    }
    const termDfMapObj = {};
    for (const [term, df] of termDfMap) {
        termDfMapObj[term] = df;
    }
    return {
        chatId,
        version: LEXICAL_INDEX_VERSION,
        fingerprint: cachedFingerprint,
        indexJson,
        termDfMap: termDfMapObj,
        lexicalDocCount,
        floorDocs,
        eventDocs,
        savedAt: Date.now(),
    };
}

let snapshotSaveInFlight = false;

async function persistSnapshotNow(chatId) {
    if (persistenceDisabled || !cachedIndex || !chatId) return;
    if (snapshotSaveInFlight) {
        // 已有保存进行中：改走脏标记，等防抖再补一轮
        markSnapshotDirty();
        return;
    }
    snapshotSaveInFlight = true;
    const T0 = performance.now();
    try {
        let indexJson;
        try {
            indexJson = JSON.stringify(cachedIndex);
        } catch (e) {
            xbLog.warn(MODULE_ID, 'Failed to serialize lexical index for snapshot', e);
            return;
        }
        await lexicalIndexTable.put(buildSnapshotPayload(chatId, indexJson));
        lastSnapshotSaveAt = Date.now();
        snapshotDirtyCount = 0;
        const ms = Math.round(performance.now() - T0);
        xbLog.info(MODULE_ID, `Lexical snapshot saved (${ms}ms, docs=${lexicalDocCount})`);
    } catch (e) {
        // Quota 超限等：停止持久化，回退纯内存，不影响检索功能
        persistenceDisabled = true;
        xbLog.warn(MODULE_ID, 'Lexical snapshot persist failed; fall back to memory-only', e);
    } finally {
        snapshotSaveInFlight = false;
    }
}

function markSnapshotDirty() {
    if (!cachedIndex || persistenceDisabled) return;
    snapshotDirtyCount++;
    if (snapshotSaveTimer) return;
    const chatId = cachedChatId;
    if (!chatId) return;
    const elapsed = Date.now() - lastSnapshotSaveAt;
    const delay = snapshotDirtyCount >= SNAPSHOT_DIRTY_THRESHOLD
        ? Math.max(0, SNAPSHOT_SAVE_MIN_INTERVAL_MS - elapsed)
        : SNAPSHOT_SAVE_IDLE_MS;
    snapshotSaveTimer = setTimeout(() => {
        snapshotSaveTimer = null;
        persistSnapshotNow(chatId);
    }, delay);
}

/**
 * 快照过期时对 楼层/事件 签名做 diff：只对新增/变更的文档增量 addAll，
 * 对已删除的 discard；不回退全量分词。
 * @returns {Promise<{addedCount:number, removedCount:number, nextCount:number}>}
 */
async function applyDiff(index, snapshot, collected) {
    const docById = new Map();
    for (const d of collected.docs) docById.set(d.id, d);

    const snapshotAllIds = new Set();
    for (const info of Object.values(snapshot.floorDocs)) {
        for (const id of (info?.docIds || [])) snapshotAllIds.add(id);
    }
    for (const id of Object.keys(snapshot.eventDocs)) snapshotAllIds.add(id);

    const removedIds = [];
    const addedDocs = [];

    // 楼层
    for (const [floorKey, info] of Object.entries(snapshot.floorDocs)) {
        const floor = Number(floorKey);
        const curIds = collected.floorDocIds.get(floor) || [];
        const curSig = collected.floorSigs.get(floor);
        if (curIds.length === 0 || info?.sig !== curSig) {
            for (const id of (info?.docIds || [])) removedIds.push(id);
            for (const id of curIds) {
                const d = docById.get(id);
                if (d) addedDocs.push(d);
            }
        }
    }
    for (const [floor, ids] of collected.floorDocIds) {
        if (!snapshot.floorDocs[floor]) {
            for (const id of ids) {
                const d = docById.get(id);
                if (d) addedDocs.push(d);
            }
        }
    }

    // 事件
    for (const [id, sig] of Object.entries(snapshot.eventDocs)) {
        if (collected.eventSigs.get(id) !== sig) removedIds.push(id);
    }
    for (const [id, sig] of collected.eventSigs) {
        if (snapshot.eventDocs[id] !== sig) {
            const d = docById.get(id);
            if (d) addedDocs.push(d);
        }
    }

    const removedSet = new Set(removedIds);
    const addedSet = new Set(addedDocs.map(d => d.id));

    for (const id of removedSet) {
        try {
            index.discard(id);
        } catch {
            // ignore
        }
        removeDocumentIdf(id);
    }

    if (addedDocs.length) {
        await addDocsBatched(index, addedDocs);
        for (const d of addedDocs) {
            // 重算新增文档 token，累计到 IDF（保留 docTokenSets 供后续内存删除递减）
            const tokens = extractUniqueTokens(d.text);
            docTokenSets.set(d.id, tokens);
            for (const token of tokens) {
                termDfMap.set(token, (termDfMap.get(token) || 0) + 1);
            }
        }
    }

    // 文档计数：快照基数 + 真正新增 - 真正删除
    let removedGone = 0;
    for (const id of removedSet) if (!addedSet.has(id)) removedGone++;
    let addedNew = 0;
    for (const id of addedSet) if (!snapshotAllIds.has(id)) addedNew++;
    const nextCount = Math.max(0, snapshot.lexicalDocCount + addedNew - removedGone);

    xbLog.info(
        MODULE_ID,
        `Lexical snapshot diff: added=${addedDocs.length} removed=${removedSet.size} count=${snapshot.lexicalDocCount}->${nextCount}`,
    );

    return { addedCount: addedDocs.length, removedCount: removedSet.size, nextCount };
}

async function resolveIndex(chatId) {
    const store = getSummaryStore();
    const events = store?.json?.events || [];

    let chunks = [];
    try {
        chunks = await getAllChunks(chatId);
    } catch (e) {
        xbLog.warn(MODULE_ID, 'Failed to load chunks', e);
    }

    const collected = collectDocuments(chunks, events);
    const { docs } = collected;
    const fingerprint = computeFingerprintFromDocs(docs);

    // 1) 内存缓存仍有效
    if (cachedIndex && cachedChatId === chatId && cachedFingerprint === fingerprint) {
        return {
            index: cachedIndex,
            fingerprint,
            floorDocIds: collected.floorDocIds,
            floorSigs: collected.floorSigs,
            eventSigs: collected.eventSigs,
            lexicalDocCount,
            needsPersist: false,
        };
    }

    // 2) 尝试持久化快照
    const snapshot = await loadSnapshot(chatId);
    if (snapshot) {
        // 2a) 快照未过期 → 直接反序列化（秒级，不重新分词）
        if (snapshot.fingerprint === fingerprint) {
            const T0 = performance.now();
            try {
                const index = await MiniSearch.loadJSONAsync(snapshot.indexJson, createMiniSearchOptions());
                termDfMap = snapshot.termDfMap;
                lexicalDocCount = snapshot.lexicalDocCount;
                const ms = Math.round(performance.now() - T0);
                xbLog.info(MODULE_ID, `Lexical snapshot loaded (${ms}ms, docs=${lexicalDocCount})`);
                return {
                    index,
                    fingerprint,
                    floorDocIds: collected.floorDocIds,
                    floorSigs: collected.floorSigs,
                    eventSigs: collected.eventSigs,
                    lexicalDocCount,
                    needsPersist: false,
                };
            } catch (e) {
                xbLog.warn(MODULE_ID, 'Failed to load snapshot index; fall back to full rebuild', e);
            }
        } else {
            // 2b) 快照过期 → 对增量做 diff，只分词新增/变更部分
            try {
                const index = await MiniSearch.loadJSONAsync(snapshot.indexJson, createMiniSearchOptions());
                termDfMap = snapshot.termDfMap;
                lexicalDocCount = snapshot.lexicalDocCount;
                const diff = await applyDiff(index, snapshot, collected);
                lexicalDocCount = diff.nextCount;
                xbLog.info(MODULE_ID, `Lexical snapshot diff applied (added=${diff.addedCount} removed=${diff.removedCount})`);
                return {
                    index,
                    fingerprint,
                    floorDocIds: collected.floorDocIds,
                    floorSigs: collected.floorSigs,
                    eventSigs: collected.eventSigs,
                    lexicalDocCount,
                    needsPersist: true,
                };
            } catch (e) {
                xbLog.warn(MODULE_ID, 'Failed to diff snapshot; fall back to full rebuild', e);
            }
        }
    }

    // 3) 无快照 / 快照不可用 → 全量重建
    const index = await buildIndexAsync(docs);
    rebuildIdfFromDocs(docs);
    return {
        index,
        fingerprint,
        floorDocIds: collected.floorDocIds,
        floorSigs: collected.floorSigs,
        eventSigs: collected.eventSigs,
        lexicalDocCount,
        needsPersist: true,
    };
}

/**
 * Expose IDF accessor for query-term selection in query-builder.
 * If index stats are not ready, this gracefully falls back to idf=1.
 */
export function getLexicalIdfAccessor() {
    return {
        enabled: lexicalDocCount > 0,
        docCount: lexicalDocCount,
        getIdf(term) {
            return computeIdf(term);
        },
    };
}

export async function getLexicalIndex() {
    const { chatId } = getContext();
    if (!chatId) return null;

    if (cachedIndex && cachedChatId === chatId && cachedFingerprint) {
        return cachedIndex;
    }

    const existingBuild = activeBuild;
    if (existingBuild?.chatId === chatId && existingBuild.generation === buildGeneration) {
        try {
            await existingBuild.promise;
            if (cachedIndex && cachedChatId === chatId && cachedFingerprint) {
                return cachedIndex;
            }
        } catch {
            // Continue to rebuild below.
        }
        if (buildGeneration !== existingBuild.generation || (activeBuild && activeBuild !== existingBuild)) {
            return null;
        }
    }

    xbLog.info(MODULE_ID, `Lexical cache miss; resolving (chatId=${chatId.slice(0, 8)})`);

    const generation = buildGeneration;
    const build = {
        chatId,
        generation,
        promise: resolveIndex(chatId),
    };
    activeBuild = build;

    try {
        const result = await build.promise;
        if (activeBuild !== build || buildGeneration !== generation) return null;
        if (!result?.index) return null;
        cachedIndex = result.index;
        cachedChatId = chatId;
        cachedFingerprint = result.fingerprint;
        floorDocIds = result.floorDocIds;
        floorSigs = result.floorSigs;
        eventSigs = result.eventSigs;
        lexicalDocCount = result.lexicalDocCount;
        if (result.needsPersist) {
            // 快照缺失/过期时后台补写，不阻塞首次返回
            persistSnapshotNow(chatId);
        }
        return cachedIndex;
    } catch (e) {
        xbLog.error(MODULE_ID, 'Index build failed', e);
        return null;
    } finally {
        if (activeBuild === build) activeBuild = null;
    }
}

export function warmupIndex() {
    const { chatId } = getContext();
    if (!chatId) return;

    getLexicalIndex().catch(e => {
        xbLog.warn(MODULE_ID, 'Warmup failed', e);
    });
}

export function invalidateLexicalIndex() {
    if (cachedIndex) {
        xbLog.info(MODULE_ID, 'Lexical index cache invalidated');
    }
    cachedIndex = null;
    cachedChatId = null;
    cachedFingerprint = null;
    buildGeneration++;
    activeBuild = null;
    floorDocIds = new Map();
    floorSigs = new Map();
    eventSigs = new Map();
    clearIdfState();
    if (snapshotSaveTimer) {
        clearTimeout(snapshotSaveTimer);
        snapshotSaveTimer = null;
    }
    snapshotDirtyCount = 0;
}

export function addDocumentsForFloor(floor, chunks) {
    if (!cachedIndex || !chunks?.length) return;

    removeDocumentsByFloor(floor);

    const docs = [];
    const docIds = [];

    for (const chunk of chunks) {
        if (!chunk?.chunkId || !chunk.text) continue;

        const doc = {
            id: chunk.chunkId,
            type: 'chunk',
            floor: chunk.floor ?? floor,
            text: chunk.text,
        };
        docs.push(doc);
        docIds.push(chunk.chunkId);
    }

    if (!docs.length) return;

    cachedIndex.addAll(docs);
    floorDocIds.set(floor, docIds);
    floorSigs.set(floor, hashFloorChunks(chunks));

    for (const doc of docs) {
        addDocumentIdf(doc.id, doc.text);
    }

    xbLog.info(MODULE_ID, `Incremental add floor=${floor} chunks=${docs.length}`);
    markSnapshotDirty();
}

export function removeDocumentsByFloor(floor) {
    if (!cachedIndex) return;

    const docIds = floorDocIds.get(floor);
    if (!docIds?.length) return;

    for (const id of docIds) {
        try {
            cachedIndex.discard(id);
        } catch {
            // Ignore if the doc was already removed/rebuilt.
        }
        removeDocumentIdf(id);
    }

    floorDocIds.delete(floor);
    floorSigs.delete(floor);
    xbLog.info(MODULE_ID, `Incremental remove floor=${floor} chunks=${docIds.length}`);
    markSnapshotDirty();
}

export function addEventDocuments(events) {
    if (!cachedIndex || !events?.length) return;

    const docs = [];

    for (const ev of events) {
        const doc = buildEventDoc(ev);
        if (!doc) continue;

        try {
            cachedIndex.discard(doc.id);
        } catch {
            // Ignore if previous document does not exist.
        }
        removeDocumentIdf(doc.id);
        eventSigs.set(doc.id, hashText(doc.text));
        docs.push(doc);
    }

    if (!docs.length) return;

    cachedIndex.addAll(docs);
    for (const doc of docs) {
        addDocumentIdf(doc.id, doc.text);
    }

    xbLog.info(MODULE_ID, `Incremental add events=${docs.length}`);
    markSnapshotDirty();
}
