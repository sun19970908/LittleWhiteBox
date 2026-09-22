/* global Buffer */
import assert from 'node:assert/strict';
import { beforeEach, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import 'fake-indexeddb/auto';
import { zipSync, unzipSync, strFromU8, strToU8 } from '../../../libs/fflate.mjs';

// Protect the import/export boundary: real ZIP codecs, Dexie transactions,
// chunk projection and embedding-input digests. Only host/network/UI boundaries
// are replaced; assertions concern persisted data, not source-code spelling.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixture = JSON.parse(await readFile(new URL('./fixtures/vector-package-v2.json', import.meta.url), 'utf8'));
const host = globalThis.__vectorPackageTest = { metadata: {}, context: {}, filters: [], config: {} };
const shims = {
    'extensions.js': 'export const getContext=()=>globalThis.__vectorPackageTest.context; export const saveMetadataDebounced=()=>{globalThis.__vectorPackageTest.metadataWrites++;};',
    'script.js': 'export const chat_metadata=globalThis.__vectorPackageTest.metadata; export const isChatSaving=false; export const getRequestHeaders=()=>({});',
    // Older supported hosts do not export SHA-256; digesting belongs to the plugin.
    'lib.js': 'export {};',
    'debug-core.js': 'export const xbLog={info(){},warn(){},error(){},debug(){}};',
    'config.js': 'export const getVectorConfig=()=>globalThis.__vectorPackageTest.config; export const getTextFilterRules=()=>globalThis.__vectorPackageTest.filters;',
    'runtime.js': 'export const refreshRecallRuntime=async()=>{globalThis.__vectorPackageTest.runtimeInvalidations++;}; export const applyRecallRuntimeMutationBestEffort=()=>{globalThis.__vectorPackageTest.runtimeMutations++;}; export const clearRecallRuntime=async()=>{};',
    'lexical-index.js': 'export const invalidateLexicalIndex=()=>{globalThis.__vectorPackageTest.lexicalInvalidations++;};',
    'siliconflow.js': 'export const embed=async(texts)=>{const host=globalThis.__vectorPackageTest; host.embeddingInputs.push(...texts); if(host.embeddingError) throw host.embeddingError; return texts.map(()=>[1,0]);};',
    'llm-service.js': 'export const callLLM=async()=>{throw new Error("unexpected LLM call");};',
};
const bundled = await build({
    stdin: { resolveDir: root, contents: [
        "export * from './modules/story-summary/vector/storage/package/service.js';",
        "export * from './modules/story-summary/vector/storage/package/codec.js';",
        "export * from './modules/story-summary/vector/storage/package/sources.js';",
        "export * from './modules/story-summary/vector/utils/vector-input-digest.js';",
        "export * as io from './modules/story-summary/vector/storage/vector-io.js';",
        "export * as store from './modules/story-summary/vector/storage/chunk-store.js';",
        "export * as stateStore from './modules/story-summary/vector/storage/state-store.js';",
        "export * as pipeline from './modules/story-summary/vector/pipeline/state-integration.js';",
        "export * as chunkPipeline from './modules/story-summary/vector/pipeline/chunk-builder.js';",
        "export { db } from './modules/story-summary/data/db.js';",
    ].join('\n') },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'host-boundaries', setup(api) {
        api.onResolve({ filter: /.*/ }, args => {
            const name = path.basename(args.path);
            return Object.hasOwn(shims, name) ? { path: name, namespace: 'host' } : null;
        });
        api.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: shims[args.path], resolveDir: root }));
    } }],
});
// eslint-disable-next-line no-unsanitized/method -- Local test bundle, no external code.
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const { db } = mod;
after(() => db.close());

beforeEach(async () => {
    for (const table of db.tables) await table.clear();
    Object.assign(host, { filters: [], config: { enabled: true }, metadataWrites: 0, runtimeInvalidations: 0, runtimeMutations: 0, lexicalInvalidations: 0, embeddingInputs: [], embeddingError: null });
    host.context = { chatId: fixture.chatId, chat: structuredClone(fixture.chat) };
    for (const key of Object.keys(host.metadata)) delete host.metadata[key];
    host.metadata.extensions = { LittleWhiteBox: {
        stateAtoms: structuredClone(fixture.atoms),
        l0Index: { version: 1, byFloor: { 0: { status: 'ok', atoms: 1, updatedAt: 1 }, 9: { status: 'empty' } } },
        storySummary: { json: { events: structuredClone(fixture.events) } },
    } };
    globalThis.fetch = async () => assert.fail('unexpected external fetch');
});

function memory() { return host.metadata.extensions.LittleWhiteBox; }
function sourceIndex() { return mod.buildSourceIndex({ chat: host.context.chat, atoms: memory().stateAtoms, events: memory().storySummary.json.events }); }
async function seedCache() {
    const source = sourceIndex();
    const chunks = [...source.chunks.values()].map(row => row.chunk);
    await mod.store.saveChunks(fixture.chatId, chunks);
    await mod.store.saveChunkVectors(fixture.chatId, chunks.map(chunk => ({ chunkId: chunk.chunkId, vector: [1, 0], sourceHash: source.chunks.get(chunk.chunkId).sourceHash })), fixture.fingerprint);
    await mod.stateStore.saveStateVectors(fixture.chatId, [...source.states.values()].map(row => ({ atomId: row.id, floor: row.floor, vector: [1, 0], rVector: [0, 1], sourceHash: row.sourceHash, relationHash: row.relationHash })), fixture.fingerprint);
    await mod.store.saveEventVectors(fixture.chatId, [...source.events.values()].map(row => ({ eventId: row.id, vector: [0.5, 0.5], sourceHash: row.sourceHash })), fixture.fingerprint);
    await mod.store.updateMeta(fixture.chatId, { fingerprint: fixture.fingerprint, lastChunkFloor: host.context.chat.length - 1 });
}
async function cacheSnapshot() { return Promise.all(db.tables.map(table => table.toArray())); }
async function createBytes() { await seedCache(); return (await mod.createVectorPackage()).bytes; }
function rewriteZip(bytes, change) {
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    change(files, manifest);
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    return zipSync(files);
}

test('current package contains only cache payloads and source digests, not chat/L0/L1 prose', async () => {
    const before = structuredClone(host.metadata);
    const bytes = await createBytes();
    const files = unzipSync(bytes);
    // Exact filenames/fields are the public ZIP protocol, not internal code layout.
    assert.deepEqual(Object.keys(files).sort(), ['chunks.bin', 'events.bin', 'manifest.json', 'relations.bin', 'states.bin']);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    assert.equal(manifest.version, 3);
    assert.deepEqual(Object.keys(manifest.chunks[0]).sort(), ['floor', 'id', 'index', 'sourceHash']);
    assert.deepEqual(Object.keys(manifest.states[0]).sort(), ['floor', 'id', 'relationHash', 'sourceHash']);
    assert.deepEqual(Object.keys(manifest.events[0]).sort(), ['id', 'sourceHash']);
    assert.deepEqual(host.metadata, before);
    assert.equal(host.metadataWrites, 0);
});

for (const method of ['importVectors', 'restoreFromServer']) {
    test(`${method}: restores all cache layers, rebuilds L1, leaves metadata and other chats untouched`, async () => {
        const bytes = await createBytes();
        const before = structuredClone(host.metadata);
        for (const table of db.tables) await table.clear();
        await db.meta.put({ chatId: 'unrelated', fingerprint: 'keep' });
        globalThis.fetch = async () => new Response(bytes);
        const result = method === 'importVectors' ? await mod.io.importVectors(new Blob([bytes])) : await mod.io.restoreFromServer();
        assert.equal(result.chunkCount, 1);
        assert.equal(result.eventCount, 1);
        assert.equal(result.stateVectorCount, 1);
        assert.equal((await db.chunks.get([fixture.chatId, 'c-0-0'])).text, fixture.chat[0].mes);
        assert.deepEqual(Array.from((await mod.stateStore.getAllStateVectors(fixture.chatId))[0].rVector), [0, 1]);
        assert.equal((await db.meta.get('unrelated')).fingerprint, 'keep');
        assert.deepEqual(host.metadata, before);
        assert.equal(host.metadataWrites, 0);
        assert.equal(host.embeddingInputs.length, 0);
        assert.equal(host.runtimeInvalidations, 1);
        assert.equal(host.lexicalInvalidations, 1);
    });
}

for (const cacheKind of ['all-layers', 'l0-only']) {
    test(`local export and server backup serialize the same cache protocol: ${cacheKind}`, async () => {
        if (cacheKind === 'all-layers') await seedCache();
        else {
            // Normal maintenance continues L0 vectorization after L1 fails. It does
            // not create L1 metadata; these generated L0 vectors are still exportable.
            host.embeddingError = Object.assign(new Error(), { embeddingFailure: { kind: 'http', status: 401 } });
            const chunkResult = await mod.chunkPipeline.buildIncrementalChunks({ vectorConfig: host.config });
            assert.equal(chunkResult.code, 'embedding_http_failed');
            host.embeddingError = null;
            const stateResult = await mod.pipeline.vectorizeMissingStateAtoms(fixture.chatId, null, { vectorConfig: host.config });
            assert.equal(stateResult.success, true);
            assert.equal(await db.meta.get(fixture.chatId), undefined);
        }
        const before = await cacheSnapshot();
        host.config = cacheKind === 'l0-only' ? {} : { embeddingApi: { provider: 'custom', model: 'different-model' } };
        const configBefore = structuredClone(host.config);
        let downloaded;
        let uploaded;
        let manifest = [];
        const originalCreate = URL.createObjectURL;
        const originalRevoke = URL.revokeObjectURL;
        const originalDocument = globalThis.document;
        URL.createObjectURL = blob => { downloaded = blob; return 'blob:fixture'; };
        URL.revokeObjectURL = () => {};
        globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };
        globalThis.fetch = async (url, options) => {
            if (!options?.body) return new Response(JSON.stringify(manifest));
            const request = JSON.parse(options.body);
            if (request.name.endsWith('.zip')) uploaded = new Uint8Array(Buffer.from(request.data, 'base64'));
            else manifest = JSON.parse(Buffer.from(request.data, 'base64').toString('utf8'));
            return new Response(JSON.stringify({ path: `user/files/${request.name}` }));
        };
        try {
            await mod.io.exportVectors();
            await mod.io.backupToServer();
            assert.deepEqual(mod.decodePackage(new Uint8Array(await downloaded.arrayBuffer())), mod.decodePackage(uploaded));
            assert.equal(mod.decodePackage(uploaded).states.length, 1);
            assert.equal(mod.decodePackage(uploaded).fingerprint, fixture.fingerprint);
            assert.equal(manifest[0].chatId, fixture.chatId);
            assert.deepEqual(await cacheSnapshot(), before);
            assert.deepEqual(host.config, configBefore);
        } finally {
            URL.createObjectURL = originalCreate;
            URL.revokeObjectURL = originalRevoke;
            globalThis.document = originalDocument;
        }
    });
}

test('export preserves a consistent source model independently of L1 metadata', async () => {
    await seedCache();
    for (const fingerprint of [null, 'stale-l1-model']) {
        await db.meta.update(fixture.chatId, { fingerprint });
        assert.equal(mod.decodePackage((await mod.createVectorPackage()).bytes).fingerprint, fixture.fingerprint);
    }
    await db.meta.delete(fixture.chatId);
    for (const [table, id] of [[db.chunkVectors, 'c-0-0'], [db.stateVectors, 'atom-0-0'], [db.eventVectors, 'e-1']]) {
        await table.update([fixture.chatId, id], { fingerprint: 'different-model' });
        await assert.rejects(mod.createVectorPackage(), error => error.code === 'invalid_package' && error.details.field === 'fingerprint');
        await table.update([fixture.chatId, id], { fingerprint: fixture.fingerprint });
    }
});

for (const failure of ['embedding', 'metadata-write', 'cancel', 'none']) {
    test(`restored L1 with a middle gap survives incremental ${failure}`, async () => {
        host.context.chat.push({ mes: 'Missing middle floor.' }, { mes: 'Restored later floor.' });
        const data = mod.decodePackage(await createBytes());
        data.chunks = data.chunks.filter(row => row.floor !== 1);
        data.chunks.find(row => row.floor === 2).vector = [0, 1];
        await mod.restoreVectorPackage(mod.encodePackage(data));
        assert.equal((await db.meta.get(fixture.chatId)).lastChunkFloor, 0);
        const before = await cacheSnapshot();
        const metadata = structuredClone(host.metadata);
        const mutations = host.runtimeMutations;
        const controller = new AbortController();
        const injected = new Error();
        let reachedWrite = false;
        const hook = () => {
            reachedWrite = true;
            if (failure === 'metadata-write') throw injected;
            if (failure === 'cancel') controller.abort();
        };
        if (failure === 'embedding') host.embeddingError = Object.assign(injected, { embeddingFailure: { kind: 'http', status: 401 } });
        db.meta.hook('updating', hook);
        let result;
        try {
            result = await mod.chunkPipeline.buildIncrementalChunks({ vectorConfig: host.config, signal: controller.signal });
        } finally { db.meta.hook('updating').unsubscribe(hook); }
        assert.equal(reachedWrite, failure !== 'embedding');
        if (failure === 'none') {
            assert.equal(result.success, true);
            assert.equal((await db.meta.get(fixture.chatId)).lastChunkFloor, 2);
            assert.deepEqual((await mod.store.getAllChunks(fixture.chatId)).map(row => row.floor).sort(), [0, 1, 2]);
            assert.equal((await mod.store.getAllChunkVectors(fixture.chatId)).length, 3);
            assert.equal(mod.decodePackage((await mod.createVectorPackage()).bytes).chunks.length, 3);
        } else {
            assert.equal(result.success, false);
            assert.equal(result.code, { embedding: 'embedding_http_failed', 'metadata-write': 'metadata_write_failed', cancel: 'vector_config_changed' }[failure]);
            if (failure === 'embedding') assert.equal(result.httpStatus, 401);
            if (failure === 'metadata-write') assert.equal(result.error, injected);
            if (failure === 'cancel') assert.equal(result.status, 'cancelled');
            assert.deepEqual(await cacheSnapshot(), before);
            assert.equal(host.runtimeMutations, mutations);
        }
        assert.deepEqual(host.metadata, metadata);
        assert.equal(host.metadataWrites, 0);
    });
}

for (const [name, change] of [
    ['L1 text', () => { host.context.chat[0].mes = 'A different scene.'; }],
    ['L0 text', () => { memory().stateAtoms[0].semantic = 'A different anchor.'; }],
    ['L0 relation', () => { memory().stateAtoms[0].edges[0].r = 'leaves'; }],
    ['event text', () => { memory().storySummary.json.events[0].summary = 'A different event.'; }],
    ['filter rules', () => { host.filters = [{ start: 'Alice', end: '' }]; }],
]) {
    test(`same IDs with changed ${name}: import AND re-export reject stale vectors`, async () => {
        const bytes = await createBytes();
        change();
        const metadata = structuredClone(host.metadata);
        const cache = await cacheSnapshot();
        await assert.rejects(mod.restoreVectorPackage(bytes), error => error.code === 'source_mismatch');
        await assert.rejects(mod.createVectorPackage(), error => ['source_mismatch', 'incomplete_cache'].includes(error.code));
        assert.deepEqual(await cacheSnapshot(), cache);
        assert.deepEqual(host.metadata, metadata);
    });
}

test('unknown input provenance cannot be fabricated at export', async () => {
    await seedCache();
    await db.stateVectors.update([fixture.chatId, 'atom-0-0'], { sourceHash: undefined });
    await assert.rejects(mod.createVectorPackage(), error => error.code === 'incomplete_cache');
});

for (const method of ['importVectors', 'restoreFromServer']) {
    for (const [name, config] of [['unconfigured', {}], ['different-model', { embeddingApi: { provider: 'custom', model: 'another-model' } }]]) {
        test(`${method}: restores with ${name} settings without changing configuration or source model`, async () => {
            const data = mod.decodePackage(await createBytes());
            data.fingerprint = 'custom:source-model:1024';
            const bytes = mod.encodePackage(data);
            host.config = structuredClone(config);
            globalThis.fetch = async () => new Response(bytes);
            const result = method === 'importVectors' ? await mod.io.importVectors(new Blob([bytes])) : await mod.io.restoreFromServer();
            assert.equal(result.stateVectorCount, data.states.length);
            for (const table of [db.meta, db.chunkVectors, db.stateVectors, db.eventVectors]) {
                assert.ok((await table.toArray()).every(row => row.fingerprint === data.fingerprint));
            }
            assert.equal(mod.decodePackage((await mod.createVectorPackage()).bytes).fingerprint, data.fingerprint);
            assert.deepEqual(host.config, config);
            assert.equal(host.embeddingInputs.length, 0);
            assert.equal(host.metadataWrites, 0);
        });
    }
}

test('changing only model settings during IO does not cancel or relabel the package', async () => {
    await seedCache();
    let generation = 0;
    const changeConfig = () => { host.config = { embeddingApi: { model: `model-${generation++}` } }; };
    const { bytes } = await mod.createVectorPackage(changeConfig);
    assert.equal(mod.decodePackage(bytes).fingerprint, fixture.fingerprint);
    let changedDuringWrite = false;
    const changeDuringWrite = () => { changedDuringWrite = true; changeConfig(); };
    db.stateVectors.hook('creating', changeDuringWrite);
    try { await mod.restoreVectorPackage(bytes); }
    finally { db.stateVectors.hook('creating').unsubscribe(changeDuringWrite); }
    assert.equal(changedDuringWrite, true);
    assert.equal((await db.meta.get(fixture.chatId)).fingerprint, fixture.fingerprint);
    assert.equal(host.embeddingInputs.length, 0);
});

for (const [name, corrupt] of [
    ['zero dimensions', (files, manifest) => { manifest.dims = 0; }],
    ['truncated binary', files => { files['states.bin'] = files['states.bin'].slice(1); }],
    ['non-finite component', files => { new DataView(files['chunks.bin'].buffer, files['chunks.bin'].byteOffset).setFloat32(0, NaN, true); }],
    ['duplicate source ID', (files, manifest) => { manifest.states.push(manifest.states[0]); }],
    ['unsupported version', (files, manifest) => { manifest.version = 100; }],
]) {
    test(`rejects ${name} without touching persisted data`, async () => {
        const bytes = rewriteZip(await createBytes(), corrupt);
        const cache = await cacheSnapshot();
        const metadata = structuredClone(host.metadata);
        await assert.rejects(mod.restoreVectorPackage(bytes), error => ['invalid_package', 'unsupported_version'].includes(error.code));
        assert.deepEqual(await cacheSnapshot(), cache);
        assert.deepEqual(host.metadata, metadata);
    });
}

for (const failure of ['storage', 'cancel', 'chat-switch', 'source-edit']) {
    test(`transaction rollback on ${failure} after earlier cache tables have been written`, async () => {
        const bytes = await createBytes();
        const cache = await cacheSnapshot();
        const metadata = structuredClone(host.metadata);
        const controller = new AbortController();
        const injected = new Error('injected storage failure');
        let reachedWrite = false;
        const hook = () => {
            reachedWrite = true;
            if (failure === 'storage') throw injected;
            if (failure === 'cancel') controller.abort();
            if (failure === 'chat-switch') host.context.chatId = 'other-chat';
            if (failure === 'source-edit') host.context.chat[0].mes = 'Changed during transaction.';
        };
        db.stateVectors.hook('creating', hook);
        const expectedCode = { cancel: 'cancelled', 'chat-switch': 'chat_changed', 'source-edit': 'source_changed' }[failure];
        try {
            await assert.rejects(mod.restoreVectorPackage(bytes, null, { signal: controller.signal }), error => failure === 'storage' ? error === injected : error.code === expectedCode);
        }
        finally { db.stateVectors.hook('creating').unsubscribe(hook); }
        assert.equal(reachedWrite, true);
        assert.deepEqual(await cacheSnapshot(), cache);
        assert.deepEqual(host.metadata, metadata);
        assert.equal(host.runtimeInvalidations, 0);
        assert.equal(host.lexicalInvalidations, 0);
    });
}

test('empty metadata is not initialized by import or export', async () => {
    const bytes = await createBytes();
    delete host.metadata.extensions;
    await assert.rejects(mod.restoreVectorPackage(bytes), error => error.code === 'source_mismatch');
    await assert.rejects(mod.createVectorPackage());
    assert.deepEqual(host.metadata, {});
    assert.equal(host.metadataWrites, 0);
});

test('a partial snapshot cannot mark absent L1 floors complete', async () => {
    host.context.chat.push({ mes: 'A new message.', is_user: false, name: 'Alice' });
    const data = mod.decodePackage(await createBytes());
    data.chunks = data.chunks.filter(row => row.floor === 0);
    await mod.restoreVectorPackage(mod.encodePackage(data));
    assert.equal((await db.meta.get(fixture.chatId)).lastChunkFloor, 0);
});

test('an L0-only cache restores without inventing relation vectors or completed L1 floors', async () => {
    const data = mod.decodePackage(await createBytes());
    data.chunks = [];
    data.events = [];
    data.states[0].rVector = null;
    data.states[0].relationHash = null;
    const result = await mod.restoreVectorPackage(mod.encodePackage(data));
    assert.equal(result.stateVectorCount, 1);
    assert.equal(result.chunkCount, 0);
    assert.equal(result.eventCount, 0);
    assert.equal((await db.stateVectors.get([fixture.chatId, 'atom-0-0'])).rVector, null);
    assert.equal((await db.meta.get(fixture.chatId)).lastChunkFloor, -1);
});

for (const method of ['importVectors', 'restoreFromServer']) {
    test(`${method}: switching chat while reading the file cannot retarget the restore`, async () => {
        const bytes = await createBytes();
        const cache = await cacheSnapshot();
        const file = { arrayBuffer: async () => {
            host.context.chatId = 'other-chat';
            return bytes;
        } };
        globalThis.fetch = async () => ({ ok: true, ...file });
        await assert.rejects(method === 'importVectors' ? mod.io.importVectors(file) : mod.io.restoreFromServer(), error => error.code === 'chat_changed');
        assert.deepEqual(await cacheSnapshot(), cache);
        assert.equal(host.metadataWrites, 0);
    });
}

test('frozen upstream v2 package verifies L0/L1, drops unproven events with a semantic warning', async () => {
    const before = structuredClone(host.metadata);
    const result = await mod.restoreVectorPackage(new Uint8Array(Buffer.from(fixture.zipBase64, 'base64')));
    assert.equal(result.chunkCount, 1);
    assert.equal(result.stateVectorCount, 1);
    assert.equal(result.eventCount, 0);
    assert.deepEqual(result.warningCodes, ['legacy_events_omitted']);
    assert.equal((await db.stateVectors.get([fixture.chatId, 'atom-0-0'])).sourceHash, mod.inputDigest('state', fixture.atoms[0].semantic));
    assert.deepEqual(host.metadata, before);
    assert.equal(host.metadataWrites, 0);
    assert.equal(host.embeddingInputs.length, 0);
});

test('a legacy archive with only unverifiable events cannot clear the existing cache', async () => {
    await seedCache();
    const before = await cacheSnapshot();
    const bytes = rewriteZip(new Uint8Array(Buffer.from(fixture.zipBase64, 'base64')), (files, manifest) => {
        manifest.chunkCount = manifest.chunkVectorCount = manifest.stateAtomCount = manifest.stateVectorCount = manifest.stateRVectorCount = 0;
        for (const name of ['chunks.jsonl', 'chunk_vectors.bin', 'state_vectors.jsonl', 'state_vectors.bin', 'state_r_vectors.bin']) files[name] = new Uint8Array();
        files['state_atoms.json'] = strToU8('[]');
    });
    await assert.rejects(mod.restoreVectorPackage(bytes), error => error.code === 'legacy_unverifiable');
    assert.deepEqual(await cacheSnapshot(), before);
    assert.equal(host.metadataWrites, 0);
});

test('legacy text is only evidence: a changed current anchor is not overwritten from the old ZIP', async () => {
    memory().stateAtoms[0].semantic = 'Current authoritative anchor.';
    const before = structuredClone(host.metadata);
    await assert.rejects(mod.restoreVectorPackage(new Uint8Array(Buffer.from(fixture.zipBase64, 'base64'))), error => error.code === 'source_mismatch');
    assert.deepEqual(host.metadata, before);
});

test('generation records the actual L0 and L1 embedding inputs for subsequent export', async () => {
    const chunkResult = await mod.chunkPipeline.buildIncrementalChunks({ vectorConfig: host.config });
    const stateResult = await mod.pipeline.vectorizeMissingStateAtoms(fixture.chatId, null, { vectorConfig: host.config });
    assert.equal(chunkResult.success, true);
    assert.equal(stateResult.success, true);
    const data = mod.decodePackage((await mod.createVectorPackage()).bytes);
    assert.equal(data.chunks[0].sourceHash, mod.inputDigest('chunk', host.embeddingInputs[0]));
    assert.equal(data.states[0].sourceHash, mod.inputDigest('state', host.embeddingInputs[1]));
    assert.equal(data.states[0].relationHash, mod.inputDigest('relation', host.embeddingInputs[2]));
});
