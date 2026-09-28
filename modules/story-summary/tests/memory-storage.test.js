/* global Buffer */
// Real summary/anchor/history transaction, HTTP confirmation and IndexedDB boundary.
// Protects import undo, source retirement and ambiguous saves; no model calls or source-text assertions.
import assert from 'node:assert/strict';
import { beforeEach, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { setImmediate as nextTurn } from 'node:timers/promises';
import path from 'node:path';
import { build } from 'esbuild';
import 'fake-indexeddb/auto';
import { maintenanceFixture, joinedEventPatch } from './fixtures/memory-maintenance.js';
import { memoryPolicy } from '../data/memory-policy.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const host = globalThis.__memoryStorageTest = { metadata: {}, context: {} };
const shims = {
    'extensions.js': 'export const getContext=()=>globalThis.__memoryStorageTest.context;',
    'script.js': 'export let chat_metadata=globalThis.__memoryStorageTest.metadata; export function reload(){chat_metadata=globalThis.__memoryStorageTest.metadata;} export const getRequestHeaders=()=>({});',
    'debug-core.js': 'export const xbLog={info(){},warn(){},error(){},debug(){}};',
    'runtime.js': 'export const applyRecallRuntimeMutationBestEffort=()=>{}; export const clearRecallRuntime=async()=>{};',
    'modules/story-summary/data/config.js': 'export const getTextFilterRules=()=>[]; export const getVectorConfig=()=>globalThis.__memoryStorageTest.vectorConfig; export const getSummaryPanelConfig=()=>({memoryMaintenanceEnabled:false});',
    'modules/story-summary/generate/llm.js': 'export const generateSummary=(...args)=>globalThis.__memoryStorageTest.generate(...args); export const parseSummaryJson=JSON.parse; export const isSummaryGenerationCancelledError=()=>false;',
    'modules/story-summary/maintenance/runner.js': 'export const createSharedMemoryAgent=()=>{throw Error("unexpected Agent request");}; export const runMemoryAgent=createSharedMemoryAgent;',
    'modules/story-summary/vector/utils/embedder.js': 'export const getEngineFingerprint=()=>"test-engine";',
    'modules/story-summary/vector/llm/siliconflow.js': 'export const embed=(texts)=>globalThis.__memoryStorageTest.embed(texts);',
};
const bundled = await build({
    stdin: { resolveDir: root, contents: [
        "export * from './modules/story-summary/data/store.js';",
        "export * from './modules/story-summary/data/memory-commit.js';",
        "export * from './modules/story-summary/data/summary-import.js';",
        "export * from './modules/story-summary/data/summary-history.js';",
        "export * from './modules/story-summary/data/anchor-extraction.js';",
        "export * from './modules/story-summary/data/anchor-invalidation.js';",
        "export * from './modules/story-summary/maintenance/domain.js';",
        "export * from './modules/story-summary/maintenance/history.js';",
        "export * from './modules/story-summary/maintenance/ranges.js';",
        "export * from './modules/story-summary/maintenance/session.js';",
        "export * from './modules/story-summary/maintenance/commit.js';",
        "export * from './modules/story-summary/maintenance/host.js';",
        "export * from './modules/story-summary/generate/generator.js';",
        "export * from './modules/story-summary/vector/storage/state-store.js';",
        "export { db, stateVectorsTable } from './modules/story-summary/data/db.js';",
        "export { reload } from 'script.js';",
    ].join('\n') },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'host-boundaries', setup(api) {
        api.onResolve({ filter: /.*/ }, args => {
            const relative = path.relative(root, path.resolve(args.resolveDir, args.path)).replaceAll('\\', '/');
            const key = Object.hasOwn(shims, relative) ? relative : path.basename(args.path);
            return Object.hasOwn(shims, key) ? { path: key, namespace: 'host' } : null;
        });
        api.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: shims[args.path], resolveDir: root }));
    } }],
});
// eslint-disable-next-line no-unsanitized/method -- Generated local test bundle, never external code.
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const originalFetch = globalThis.fetch;
after(() => { mod.db.close(); globalThis.fetch = originalFetch; delete globalThis.__memoryStorageTest; });
const ext = () => host.metadata.extensions.LittleWhiteBox;
const disk = () => host.files.get(host.context.chatId).extensions.LittleWhiteBox;

beforeEach(async () => {
    for (const table of mod.db.tables) await table.clear();
    const fixture = maintenanceFixture();
    Object.assign(host, { fixture, mode: 'save', reads: 0, writes: 0, afterSave: null, files: new Map(), metadata: { extensions: { LittleWhiteBox: {} } } });
    host.vectorConfig = { enabled: false, embeddingApi: {} };
    host.generate = () => assert.fail('unexpected summary request');
    host.embed = () => assert.fail('unexpected embedding request');
    host.context = { ...fixture, characterId: 0, characters: [{ name: '角色', chat: fixture.chatId, avatar: 'fixture.png' }],
        saveMetadata: async () => {
            host.writes++;
            if (host.mode !== 'old') host.files.set(host.context.chatId, structuredClone(host.metadata));
            await host.afterSave?.();
            if (host.mode === 'throw_after' || host.mode === 'old') throw new Error('transport');
        },
    };
    host.files.set(fixture.chatId, structuredClone(host.metadata));
    globalThis.fetch = async (url, request) => {
        host.reads++;
        if (host.mode === 'read_fail') throw new Error('read offline');
        const key = JSON.parse(request.body).file_name;
        return new Response(JSON.stringify([{ chat_metadata: host.files.get(key) }]));
    };
    mod.reload();
    mod.getSummaryStore();
});

async function importFixture() {
    const next = mod.prepareImportedSummary(mod.readSummaryMemory(), host.fixture.json, host.fixture.cutoff);
    await mod.commitSummaryMemory(host.context.chatId, next);
    return structuredClone(ext().storySummary.json);
}

async function seedAnchors() {
    const next = mod.readSummaryMemory();
    next.stateAtoms = structuredClone(host.fixture.atoms);
    next.l0Index = structuredClone(host.fixture.l0Index);
    await mod.commitSummaryMemory(host.context.chatId, next);
}

async function maintain(commands) {
    const next = mod.readSummaryMemory();
    const { memory, results } = mod.editMemoryBatch({ json: next.storySummary.json, atoms: next.stateAtoms }, commands, host.fixture.cutoff);
    const operations = results.map((result, index) => ({ ...commands[index], changes: result.changes }));
    next.storySummary.json = memory.json;
    next.stateAtoms = memory.atoms;
    mod.appendMaintenanceReceipt(next.storySummary, { version: 2, id: `receipt-${host.writes}`, runId: 'storage-test', policy: memoryPolicy(), operations,
        coverage: { supplied: [], missingAnchors: [] } });
    await mod.commitSummaryMemory(host.context.chatId, next);
    return operations;
}
const fixFact = { kind: 'edit', collection: 'facts', key: 'f-1', patch: { o: '未经证实的传闻' } };
const fixAnchor = { kind: 'edit', collection: 'anchors', key: 'atom-1-0', patch: { semantic: '夏实说听说可能如此，自己没有确证。' } };

function readMaintenanceState() {
    const store = mod.getSummaryStore();
    return { chatId: host.context.chatId, chat: host.context.chat, store, json: store.json,
        cutoff: store.lastSummarizedMesId, atoms: mod.getStateAtoms(), l0Index: mod.getL0Index() };
}

async function saveMaintenanceSession(session) {
    return mod.commitMemorySession(session, { runId: 'session-test', calls: [] }, {
        read: readMaintenanceState,
        commit: (next, previous, _impact, validate) => mod.commitSummaryMemory(host.context.chatId, next,
            { previous, validate, maintenanceWrite: true }),
    });
}

for (const action of ['completion', 'outcome', 'anchor', 'summary']) {
    test(`pending generation survives ${action} maintenance unless its summary input changed`, async () => {
        await importFixture(); await seedAnchors();
        const initial = mod.readSummaryMemory();
        initial.storySummary.updatedAt = 1;
        await mod.commitSummaryMemory(host.context.chatId, initial);
        host.context.chat.push({ mes: '次日', is_user: true }, { mes: '共同出发', is_user: false });
        const session = mod.createMemorySession(readMaintenanceState()); session.initial();
        let release, entered;
        const started = new Promise(resolve => { entered = resolve; });
        host.generate = () => { entered(); return new Promise(resolve => { release = resolve; }); };
        const generating = mod.runSummaryGeneration(25, { trigger: { delayFloors: 0 } });
        await started;
        if (action === 'completion') session.runTool('CompleteMaintenance', { from: 1, to: 24 });
        else if (action === 'outcome') session.conclude({ status: 'partial', summary: '下次继续' });
        else session.runTool('EditMemory', { edits: [action === 'anchor' ? fixAnchor : fixFact] });
        let saved;
        try { saved = await saveMaintenanceSession(session); }
        finally { release(JSON.stringify({ events: [], factUpdates: [{ s: '旅人', p: '行程', o: '共同出发', isState: false }] })); }
        const result = await generating;
        assert.equal(result.success, action !== 'summary', JSON.stringify(result));
        assert.equal(result.stale === true, action === 'summary');
        assert.equal(saved.current.store.updatedAt === 1, action !== 'summary');
        assert.ok(ext().storySummary.summaryHistory[0].maintenance.some(receipt => receipt.id === saved.receipt.id));
        assert.equal(ext().storySummary.lastSummarizedMesId, action === 'summary' ? 23 : 25);
        if (action === 'summary') assert.equal(ext().storySummary.json.facts[0].o, fixFact.patch.o);
        if (action === 'anchor') assert.equal(ext().stateAtoms[0].semantic, fixAnchor.patch.semantic);
    });
}

for (const scenario of ['completion', 'outcome', 'anchor', 'summary', 'source-edit', 'cancel', 'chat-switch', 'save-rejected', 'save-unconfirmed']) {
    test(`summary response during ${scenario} maintenance save waits, then revalidates before committing`, async () => {
        await importFixture(); await seedAnchors();
        const initial = mod.readSummaryMemory();
        host.context.chat.push({ mes: '次日', is_user: true }, { mes: '共同出发', is_user: false });
        const session = mod.createMemorySession(readMaintenanceState()); session.initial();
        const controller = new AbortController();
        let release, entered, calls = 0, settled = false;
        const started = new Promise(resolve => { entered = resolve; });
        host.generate = () => { calls++; entered(); return new Promise(resolve => { release = resolve; }); };
        const generating = mod.runSummaryGeneration(25, { trigger: { delayFloors: 0 } }, {}, { signal: controller.signal })
            .then(result => { settled = true; return result; });
        await started;
        if (scenario === 'outcome') session.conclude({ status: 'partial', summary: '下次继续' });
        else if (scenario === 'anchor' || scenario === 'summary') {
            session.runTool('EditMemory', { edits: [scenario === 'anchor' ? fixAnchor : fixFact] });
        } else session.runTool('CompleteMaintenance', { from: 1, to: 24 });
        let finishSave, saveEntered;
        const saveStarted = new Promise(resolve => { saveEntered = resolve; });
        host.afterSave = () => { saveEntered(); return new Promise(resolve => { finishSave = resolve; }); };
        if (scenario === 'save-rejected') {
            host.mode = 'old';
            const saveMetadata = host.context.saveMetadata;
            host.context.saveMetadata = async () => {
                try { await saveMetadata(); }
                finally { host.mode = 'save'; host.context.saveMetadata = saveMetadata; }
            };
        }
        if (scenario === 'save-unconfirmed') host.mode = 'read_fail';
        const writes = host.writes;
        const saving = saveMaintenanceSession(session);
        const saved = scenario === 'save-rejected'
            ? assert.rejects(saving, { code: 'metadata_not_saved', uncertain: false })
            : scenario === 'save-unconfirmed'
                ? assert.rejects(saving, { code: 'metadata_save_unconfirmed', uncertain: true }) : saving;
        let result, maintenance;
        try {
            await saveStarted;
            release(JSON.stringify({ events: [], factUpdates: [{ s: '旅人', p: '行程', o: '共同出发', isState: false }] }));
            await nextTurn();
            assert.equal(settled, false);
            assert.equal(host.writes, writes + 1);
            if (scenario === 'source-edit') host.context.chat[24].mes = '修改后的来源';
            if (scenario === 'chat-switch') host.context = { ...host.context, chatId: 'other-chat' };
            if (scenario === 'cancel') {
                controller.abort();
                await nextTurn();
                assert.equal(settled, true); // Cancellation must not wait for the unrelated save.
            }
        } finally {
            host.afterSave = null;
            finishSave?.();
            try { maintenance = await saved; }
            finally { host.mode = 'save'; result = await generating; }
        }
        const commits = ['completion', 'outcome', 'anchor', 'save-rejected'].includes(scenario);
        assert.equal(result.success, commits, JSON.stringify(result));
        assert.equal(result.stale === true, ['summary', 'source-edit'].includes(scenario));
        assert.equal(result.cancelled === true, ['cancel', 'chat-switch'].includes(scenario));
        if (scenario === 'save-unconfirmed') {
            assert.equal(result.error.code, 'metadata_unconfirmed');
            assert.equal(mod.getMemoryCommitState(), 'unconfirmed');
        } else assert.equal(mod.getMemoryCommitState(), 'ready');
        assert.equal(calls, 1);
        assert.equal(host.writes, writes + 1 + Number(commits));
        assert.equal(ext().storySummary.lastSummarizedMesId, commits ? 25 : 23);
        if (maintenance) assert.ok(ext().storySummary.summaryHistory[0].maintenance.some(receipt => receipt.id === maintenance.receipt.id));
        if (scenario === 'save-rejected') assert.deepEqual(ext().storySummary.summaryHistory[0].maintenance,
            initial.storySummary.summaryHistory[0].maintenance);
        assert.equal(ext().storySummary.json.facts.some(fact => fact.s === '旅人' && fact.p === '行程' && fact.o === '共同出发'), commits);
        if (scenario === 'summary') assert.equal(ext().storySummary.json.facts[0].o, fixFact.patch.o);
        if (scenario === 'anchor') assert.equal(ext().stateAtoms[0].semantic, fixAnchor.patch.semantic);
        assert.deepEqual(host.files.get(host.fixture.chatId).extensions.LittleWhiteBox, ext());
    });
}

for (const kind of ['edit', 'merge']) {
    test(`${kind} event canonicalizes names and causes before receipts; reload preserves exact rollback`, async () => {
        const original = await importFixture();
        await maintain([{ kind, collection: 'events', key: 'evt-1',
            ...(kind === 'merge' ? { removeIds: ['evt-2'] } : {}),
            patch: { ...(kind === 'merge' ? joinedEventPatch : {}), participants: [' 夏实 ', ' 药君 '], causedBy: [' evt-3 '] } }]);
        const receipt = disk().storySummary.summaryHistory[0].maintenance[0];
        const savedEvent = disk().storySummary.json.events.find(event => event.id === 'evt-1');
        assert.deepEqual(savedEvent.participants, ['夏实', '药君']);
        assert.deepEqual(savedEvent.causedBy, ['evt-3']);
        assert.deepEqual(receipt.operations[0].changes.find(change => change.key === 'evt-1').after, savedEvent);
        host.metadata = structuredClone(host.files.get(host.context.chatId)); mod.reload(); mod.getSummaryStore();
        assert.deepEqual(ext().storySummary.json.events.find(event => event.id === 'evt-1'), savedEvent);
        assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
        assert.deepEqual(ext().storySummary.json, original);
        assert.deepEqual(disk(), ext());
    });
}

test('index status and repair include earlier runs regardless of results pagination', async () => {
    await importFixture(); await seedAnchors();
    await maintain([{ kind: 'edit', collection: 'events', key: 'evt-1', patch: { title: '红山项链误会' } }, fixAnchor]);
    const next = mod.readSummaryMemory();
    for (let i = 0; i < 10; i++) mod.appendMaintenanceReceipt(next.storySummary, {
        version: 2, id: `later-${i}`, runId: `later-run-${i}`, policy: memoryPolicy(), operations: [],
        coverage: { supplied: [], missingAnchors: [] }, outcome: { status: 'partial' },
    });
    await mod.commitSummaryMemory(host.context.chatId, next, { maintenanceWrite: true });
    host.vectorConfig.enabled = true;
    const maintenance = mod.createMemoryMaintenanceHost({ canRun: () => true, changed() {} });
    const first = await maintenance.results(), older = await maintenance.results(10);
    assert.equal(first.items.length, 10); assert.equal(older.items.length, 1);
    assert.deepEqual(first.index, { status: 'pending', count: 2 });
    assert.deepEqual(older.index, first.index);
    let embedded = 0;
    host.embed = texts => { embedded += texts.length; return texts.map(() => [1, 0]); };
    assert.equal((await maintenance.repairIndexes()).status, 'ready');
    assert.equal(embedded, 3); // One event, one anchor's scene and one relation vector.
    assert.deepEqual((await maintenance.results()).index, { status: 'ready', count: 0 });
    assert.deepEqual((await maintenance.results(10)).index, { status: 'ready', count: 0 });
});

async function completeRange(from = 1, to = 24) {
    const next = mod.readSummaryMemory();
    mod.appendMaintenanceReceipt(next.storySummary, { version: 2, id: `complete-${host.writes}`, runId: 'complete-run', policy: memoryPolicy(),
        cutoff: host.fixture.cutoff + 1, operations: [], completion: { from, to }, coverage: { supplied: [], missingAnchors: [] } });
    await mod.commitSummaryMemory(host.context.chatId, next, { maintenanceWrite: true });
}
const progress = () => mod.maintenanceRanges(ext().storySummary.summaryHistory, ext().storySummary.lastSummarizedMesId);

test('completion survives reload; manual edits invalidate its fixed baseline in the same confirmed save', async () => {
    await importFixture(); await completeRange();
    host.metadata = structuredClone(host.metadata); mod.reload(); mod.getSummaryStore();
    assert.deepEqual(progress().pending, []);
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = '用户改动';
    await mod.commitSummaryMemory(host.context.chatId, next);
    assert.deepEqual(progress().pending, [{ from: 1, to: 24 }]);
    assert.deepEqual(disk(), ext());
});

test('late anchors reopen just their floor; clear and same-ID regeneration never resurrect completion', async () => {
    await importFixture(); await completeRange();
    const next = mod.readSummaryMemory(); next.stateAtoms.push(structuredClone(host.fixture.atoms[0]));
    await mod.commitSummaryMemory(host.context.chatId, next);
    assert.deepEqual(progress().pending, [{ from: 2, to: 2 }]);
    await completeRange(2, 2);
    const cleared = mod.readSummaryMemory(); mod.invalidateMemoryAnchors(cleared, 1, 'anchors_cleared');
    await mod.commitSummaryMemory(host.context.chatId, cleared);
    const afterClear = progress();
    host.metadata = structuredClone(host.metadata); mod.reload(); mod.getSummaryStore();
    const rebuilt = mod.readSummaryMemory(); rebuilt.stateAtoms.push(structuredClone(host.fixture.atoms[0]));
    await mod.commitSummaryMemory(host.context.chatId, rebuilt);
    assert.deepEqual(progress(), afterClear);
    assert.deepEqual(disk(), ext());
});

test('own edits retain completed ranges; import replacement and rollback remove their receipts', async () => {
    await importFixture(); await completeRange();
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = '维护修正';
    await mod.commitSummaryMemory(host.context.chatId, next, { maintenanceWrite: true });
    assert.deepEqual(progress().pending, []);
    await mod.rollbackSummaryOnce(host.context.chatId);
    assert.deepEqual(progress().completed, []);
    await completeRange(); await importFixture();
    assert.deepEqual(progress().completed, []);
});

test('old-server save and uncertain save never publish newly completed ranges', async () => {
    for (const mode of ['old', 'read_fail']) {
        host.mode = 'save'; await importFixture();
        host.mode = mode;
        await assert.rejects(completeRange());
        const published = mod.readPublishedSummaryMemory();
        assert.deepEqual(mod.maintenanceRanges(published.storySummary.summaryHistory, 23).completed, []);
        if (mode === 'read_fail') assert.equal(mod.getMemoryCommitState(), 'unconfirmed');
    }
});

test('actual import baseline: repeated maintenance is reversible but imported events/facts are not erased', async () => {
    const original = await importFixture();
    assert.equal(mod.getRollbackOnceTargetEndMesId(ext().storySummary), null);
    await maintain([fixFact]);
    await maintain([{ ...fixFact, patch: { o: '夏实只听说，未查证' } }]);
    host.metadata = structuredClone(host.metadata); mod.reload();
    const result = await mod.rollbackSummaryOnce(host.context.chatId);
    assert.equal(result.success, true);
    assert.equal(result.targetEndMesId, 23);
    assert.deepEqual(ext().storySummary.json, original);
    assert.equal(original.events.length, 4);
    assert.equal(original.facts.length, 5);
    assert.equal(mod.getRollbackOnceTargetEndMesId(ext().storySummary), null);
    assert.deepEqual(disk(), ext());
});

test('fact correction survives the next generated batch; batch then maintenance rollback restores the original facts', async () => {
    host.fixture.json.facts.push({ id: 'f-6', s: '药君', p: '物品', o: '拥有药杖', since: 3, _addedAt: 19 });
    const original = await importFixture();
    const correction = { kind: 'edit', collection: 'facts', key: 'f-2', patch: { s: '药君', o: '拥有药箱和药杖' } };
    await assert.rejects(maintain([correction]), { code: 'fact_conflict' });
    assert.deepEqual(disk().storySummary.json, original);
    await maintain([correction, { kind: 'delete', collection: 'facts', key: 'f-6' }]);
    const corrected = structuredClone(ext().storySummary.json);
    const next = mod.readSummaryMemory();
    const merged = mod.mergeNewData(next.storySummary.json, { factUpdates: [] }, 25, { returnMeta: true });
    assert.deepEqual(merged.json.facts, corrected.facts);
    next.storySummary.json = merged.json;
    next.storySummary.lastSummarizedMesId = 25;
    mod.addSummarySnapshot(next.storySummary, 23, 25, merged.undo);
    host.context.chat.push({ mes: '次日', is_user: true }, { mes: '出发' });
    await mod.commitSummaryMemory(host.context.chatId, next);
    assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
    assert.deepEqual(ext().storySummary.json, corrected);
    assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
    assert.deepEqual(ext().storySummary.json, original);
    assert.deepEqual(disk(), ext());
});

test('upstream import boundary converts once; corrupt exact inverse cannot become a baseline', () => {
    const oldImport = [{ endMesId: 23 }];
    const upgraded = mod.upgradeSummaryHistory(oldImport);
    assert.equal(upgraded.value[0].kind, 'baseline');
    assert.equal(mod.getRollbackOnceTargetEndMesId({ lastSummarizedMesId: 23, summaryHistory: upgraded.value }), null);
    assert.throws(() => mod.upgradeSummaryHistory([{ format: 1, previousEndMesId: -1, endMesId: 23, undo: { version: 1, unknown: true } }]));
});

for (const kind of ['edit', 'delete']) {
    test(`${kind} anchor: clear retires history, reload and same-ID extraction cannot resurrect old source`, async () => {
        const original = await importFixture();
        await seedAnchors();
        await maintain([fixFact, { ...fixAnchor, kind }]);
        await mod.saveStateVectors(host.context.chatId, [{ atomId: 'atom-1-0', floor: 1, vector: [1, 0] }], 'test');
        const writes = host.writes;
        await mod.invalidateSummaryAnchors(host.context.chatId, 0, 'anchors_cleared');
        assert.equal(host.writes - writes, 1);
        assert.equal((await mod.getAllStateVectors(host.context.chatId)).length, 0);
        const receipt = ext().storySummary.summaryHistory[0].maintenance[0];
        assert.equal(receipt.operations[1].changes[0].retired.reason, 'anchors_cleared');
        assert.equal(mod.maintenanceImpact(receipt.operations).atomIds.length, 0);
        assert.ok(receipt.operations[1].changes[0].before);
        host.metadata = structuredClone(host.metadata); mod.reload();
        const extraction = mod.createAnchorExtractionDraft(host.context.chatId, host.context.chat);
        const regenerated = { ...host.fixture.atoms[0], semantic: '重新提取的新正文，不能被旧撤销覆盖' };
        extraction.addAtoms([regenerated]);
        extraction.setStatus(1, { status: 'ok', atoms: 1 });
        await extraction.commit();
        assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
        assert.deepEqual(ext().storySummary.json, original);
        assert.deepEqual(ext().stateAtoms, [regenerated]);
    });
}

test('active anchor conflicts still refuse undo; retirement only skips explicitly invalidated changes', async () => {
    await importFixture(); await seedAnchors(); await maintain([fixFact, fixAnchor]);
    const edit = mod.readSummaryMemory();
    edit.stateAtoms[0].semantic = '人工修改';
    await mod.commitSummaryMemory(host.context.chatId, edit);
    const before = structuredClone(ext());
    const result = await mod.rollbackSummaryOnce(host.context.chatId);
    assert.equal(result.reason, 'history_discontinuous');
    assert.deepEqual(ext(), before);
});

test('source invalidation scans every batch, including absent anchors, before undoing a generated batch', async () => {
    await importFixture(); await seedAnchors();
    await maintain([{ ...fixAnchor, kind: 'delete' }]);
    // Add a new generated batch after the imported baseline.
    const next = mod.readSummaryMemory();
    const merged = mod.mergeNewData(next.storySummary.json, { factUpdates: [{ s: '夏实', p: '城市', o: '北京' }] }, 25, { returnMeta: true });
    next.storySummary.json = merged.json;
    next.storySummary.lastSummarizedMesId = 25;
    mod.addSummarySnapshot(next.storySummary, 23, 25, merged.undo);
    await mod.commitSummaryMemory(host.context.chatId, next);
    host.context.chat.push({ mes: 'new', is_user: true }, { mes: 'new reply', is_user: false });
    // Ordinary edit keeps L2 but retires the older, already absent L0 operation.
    await mod.rollbackSummaryIfNeeded({ invalidateFromFloor: 1 });
    assert.equal(ext().storySummary.lastSummarizedMesId, 25);
    assert.ok(ext().storySummary.summaryHistory[0].maintenance[0].operations[0].changes[0].retired);
    const result = await mod.rollbackSummaryIfNeeded({ changedFromFloor: 24 });
    assert.equal(result.status, 'rolled_back');
    assert.equal(ext().storySummary.lastSummarizedMesId, 23);
    assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
    assert.equal(ext().stateAtoms.length, 0);
});

test('source replacement across baseline preserves imported content and persists only source invalidity', async () => {
    const original = await importFixture(); await seedAnchors();
    host.context.chat[20].mes = 'changed';
    const result = await mod.rollbackSummaryIfNeeded({ changedFromFloor: 20 });
    assert.equal(result.reason, 'source_boundary_invalid');
    assert.deepEqual(ext().storySummary.json, original);
    assert.equal(ext().storySummary.sourceInvalidFromFloor, 20);
    assert.equal(ext().storySummary.summaryInvalid, undefined);
    assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
    assert.deepEqual(disk(), ext());
});

test('undoing baseline maintenance cannot clear an unresolved source boundary', async () => {
    const original = await importFixture(); await maintain([fixFact]);
    await mod.rollbackSummaryIfNeeded({ changedFromFloor: 20 });
    assert.equal((await mod.rollbackSummaryOnce(host.context.chatId)).success, true);
    assert.deepEqual(ext().storySummary.json, original);
    assert.equal(ext().storySummary.sourceInvalidFromFloor, 20);
    assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
});

test('source stays blocked when both rollback and safety-marker saves are confirmed not saved', async () => {
    await importFixture();
    host.mode = 'old';
    await assert.rejects(mod.rollbackSummaryIfNeeded({ changedFromFloor: 20 }), { code: 'metadata_not_saved' });
    assert.equal(mod.getMemoryCommitState(), 'source_invalid');
    assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
    assert.equal(ext().storySummary.summaryInvalid, undefined);
    host.mode = 'save';
    await mod.clearSummaryData(host.context.chatId);
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

test('ordinary source edit with failed vector cleanup blocks old anchors without corrupting history', async t => {
    await importFixture(); await seedAnchors(); await maintain([fixAnchor]);
    const original = structuredClone(ext().storySummary.json);
    const cacheFailure = t.mock.method(mod.stateVectorsTable, 'where', () => { throw new Error('cache offline'); });
    host.context.chat[1].mes = 'edited source';
    await assert.rejects(mod.rollbackSummaryIfNeeded({ invalidateFromFloor: 1 }), { code: 'memory_cache_invalidation_failed' });
    assert.deepEqual(ext().storySummary.json, original);
    assert.equal(ext().storySummary.summaryInvalid, undefined);
    assert.equal(ext().storySummary.sourceInvalidFromFloor, 1);
    assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
    assert.deepEqual(disk(), ext());
    cacheFailure.mock.restore();
    await mod.clearSummaryData(host.context.chatId);
    assert.equal(ext().stateAtoms.length, 0);
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

test('ordinary source edit with failed metadata save remains blocked until invalid anchors are cleared', async () => {
    await importFixture(); await seedAnchors(); await maintain([fixAnchor]);
    host.mode = 'old';
    host.context.chat[1].mes = 'edited source';
    await assert.rejects(mod.rollbackSummaryIfNeeded({ invalidateFromFloor: 1 }), { code: 'metadata_not_saved' });
    assert.equal(mod.getMemoryCommitState(), 'source_invalid');
    assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
    host.mode = 'save';
    await mod.clearSummaryData(host.context.chatId);
    assert.equal(ext().stateAtoms.length, 0);
    assert.deepEqual(ext().l0Index.byFloor, {});
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

test('in-flight saves publish no draft receipt and reject another writer without overwriting it', async () => {
    await importFixture();
    let finish;
    host.afterSave = () => new Promise(resolve => { finish = resolve; });
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = 'pending';
    const saving = mod.commitSummaryMemory(host.context.chatId, next);
    while (!finish) await Promise.resolve();
    let resumed = false;
    const waiting = mod.waitForMemoryCommit().then(() => { resumed = true; });
    const controller = new AbortController();
    const cancelled = mod.waitForMemoryCommit(controller.signal);
    controller.abort();
    await assert.rejects(cancelled, { name: 'AbortError' });
    await Promise.resolve();
    assert.equal(resumed, false);
    assert.equal(mod.getMemoryCommitState(), 'saving');
    assert.notEqual(mod.readPublishedSummaryMemory().storySummary.json.facts[0].o, 'pending');
    await assert.rejects(mod.commitSummaryMemory(host.context.chatId, mod.readSummaryMemory()), { code: 'metadata_saving' });
    finish(); await saving;
    await waiting;
    assert.equal(resumed, true);
    assert.equal(mod.readPublishedSummaryMemory().storySummary.json.facts[0].o, 'pending');
});

test('failed save confirmed old restores the entire previous snapshot in one place', async () => {
    await importFixture(); await seedAnchors();
    const before = structuredClone(ext());
    host.mode = 'old';
    const next = mod.prepareImportedSummary(mod.readSummaryMemory(), { events: [], facts: [] }, 23);
    await assert.rejects(mod.commitSummaryMemory(host.context.chatId, next), { code: 'metadata_not_saved', uncertain: false });
    assert.deepEqual(ext(), before);
    assert.deepEqual(disk(), before);
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

for (const mode of ['read_fail', 'different']) {
    test(`${mode}: ambiguous import never restores old memory, gates every write, and reload is read-only recovery`, async () => {
        await importFixture(); await seedAnchors();
        host.mode = mode;
        if (mode === 'different') host.afterSave = () => { disk().storySummary.json.facts[0].o = 'external disk edit'; };
        const next = mod.prepareImportedSummary(mod.readSummaryMemory(), host.fixture.json, 23);
        next.storySummary.json.facts[0].o = 'new import';
        const reads = host.reads;
        await assert.rejects(mod.commitSummaryMemory(host.context.chatId, next), { uncertain: true });
        assert.equal(ext().storySummary.json.facts[0].o, 'new import');
        assert.equal(ext().stateAtoms.length, 0);
        assert.equal(mod.getMemoryCommitState(), 'unconfirmed');
        await mod.waitForMemoryCommit();
        assert.throws(() => mod.assertMemoryWritable(), { uncertain: true });
        assert.equal(ext().storySummary.summaryInvalid, undefined);
        assert.equal(mod.isSummaryConsumable(ext().storySummary, 24), false);
        assert.equal(host.reads - reads, mode === 'read_fail' ? 3 : 1);
        const writes = host.writes;
        await assert.rejects(mod.clearSummaryData(host.context.chatId), { uncertain: true });
        await assert.rejects(mod.invalidateSummaryAnchors(host.context.chatId), { uncertain: true });
        assert.throws(() => mod.createAnchorExtractionDraft(host.context.chatId, host.context.chat), { uncertain: true });
        assert.equal(host.writes, writes);
        host.metadata = structuredClone(host.files.get(host.context.chatId)); mod.reload(); mod.getSummaryStore();
        assert.equal(mod.getMemoryCommitState(), 'ready');
        assert.equal(host.writes, writes);
    });
}

test('thrown save with confirmed new disk is success, not a false rollback', async () => {
    await importFixture(); host.mode = 'throw_after';
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = 'confirmed';
    await mod.commitSummaryMemory(host.context.chatId, next);
    assert.deepEqual(disk(), ext());
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

test('concurrent manual mutation during a failed save is preserved and quarantined, never restored over', async () => {
    await importFixture(); host.mode = 'old';
    host.afterSave = () => { ext().storySummary.json.facts[1].o = 'later manual edit'; };
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = 'staged';
    await assert.rejects(mod.commitSummaryMemory(host.context.chatId, next), { uncertain: true });
    assert.equal(ext().storySummary.json.facts[1].o, 'later manual edit');
    assert.equal(mod.getMemoryCommitState(), 'unconfirmed');
});

test('draft validation and vector failure leave canonical memory unchanged and release the write gate', async () => {
    await importFixture();
    const before = structuredClone(ext());
    const writes = host.writes;
    await assert.rejects(mod.commitSummaryMemory(host.context.chatId, mod.readSummaryMemory(), {
        invalidate: async () => { throw new Error('cache unavailable'); },
    }));
    assert.deepEqual(ext(), before);
    assert.equal(host.writes, writes);
    assert.equal(mod.getMemoryCommitState(), 'ready');
});

test('L0 results remain draft-only, merge with newer summary, but cannot overwrite an edited source', async () => {
    await importFixture();
    const extraction = mod.createAnchorExtractionDraft(host.context.chatId, host.context.chat);
    extraction.addAtoms(host.fixture.atoms.slice(0, 1)); extraction.setStatus(1, { status: 'ok', atoms: 1 });
    assert.equal(ext().stateAtoms.length, 0);
    await maintain([fixFact]);
    await extraction.commit();
    assert.equal(ext().storySummary.json.facts[0].o, fixFact.patch.o);
    const stale = mod.createAnchorExtractionDraft(host.context.chatId, host.context.chat);
    stale.setStatus(3, { status: 'empty', atoms: 0 });
    host.context.chat[2].mes = 'changed USER';
    await assert.rejects(stale.commit(), { code: 'metadata_draft_conflict' });
    assert.equal(ext().l0Index.byFloor[3], undefined);
});

test('a chat switch during confirmation never restores or installs into the newly opened chat', async () => {
    await importFixture();
    const old = host.metadata;
    host.afterSave = () => {
        host.metadata = { extensions: { LittleWhiteBox: { storySummary: { json: { facts: ['other chat'] } } } } };
        host.context = { ...host.context, chatId: 'other' }; mod.reload();
    };
    const next = mod.readSummaryMemory(); next.storySummary.json.facts[0].o = 'first chat';
    await mod.commitSummaryMemory(host.context.chatId, next);
    assert.equal(old.extensions.LittleWhiteBox.storySummary.json.facts[0].o, 'first chat');
    assert.deepEqual(ext().storySummary.json.facts, ['other chat']);
    assert.equal(mod.getMemoryCommitState(), 'ready');
});
