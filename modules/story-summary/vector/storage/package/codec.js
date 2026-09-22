import { zipSync, unzipSync, strToU8 } from '../../../../../libs/fflate.mjs';
import { packageError } from './messages.js';
import { assertDimensions, assertUniqueRows, assertVector, decodeVectors, encodeVectors, readJson, requirePackage } from './format.js';
import { decodeLegacyV2 } from './legacy-v2.js';

const VERSION = 3;
const FORMAT = 'littlewhitebox-vector-cache';
const HASH = /^[a-f0-9]{64}$/;

export function validatePackage(data) {
    assertDimensions(data.dims);
    requirePackage(typeof data.chatId === 'string' && data.chatId.length > 0);
    requirePackage(typeof data.fingerprint === 'string' && data.fingerprint.length > 0);
    for (const rows of [data.chunks, data.states, data.events]) {
        assertUniqueRows(rows);
        for (const row of rows) {
            requirePackage(typeof row.sourceHash === 'string' && HASH.test(row.sourceHash));
            assertVector(row.vector, data.dims);
        }
    }
    for (const row of [...data.chunks, ...data.states]) requirePackage(Number.isSafeInteger(row.floor) && row.floor >= 0);
    for (const row of data.chunks) requirePackage(Number.isSafeInteger(row.index) && row.index >= 0);
    for (const row of data.states) {
        requirePackage(row.relationHash === null || (typeof row.relationHash === 'string' && HASH.test(row.relationHash)));
        if (row.relationHash === null) requirePackage(row.rVector === null);
        else assertVector(row.rVector, data.dims);
    }
}

export function encodePackage(data) {
    validatePackage(data);
    const { chatId, fingerprint, dims } = data;
    const manifest = {
        format: FORMAT, version: VERSION, chatId, fingerprint, dims,
        chunks: data.chunks.map(({ id, floor, index, sourceHash }) => ({ id, floor, index, sourceHash })),
        states: data.states.map(({ id, floor, sourceHash, relationHash }) => ({ id, floor, sourceHash, relationHash })),
        events: data.events.map(({ id, sourceHash }) => ({ id, sourceHash })),
    };
    return zipSync({
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'chunks.bin': encodeVectors(data.chunks.map(row => row.vector), dims),
        'states.bin': encodeVectors(data.states.map(row => row.vector), dims),
        'relations.bin': encodeVectors(data.states.filter(row => row.relationHash !== null).map(row => row.rVector), dims),
        'events.bin': encodeVectors(data.events.map(row => row.vector), dims),
    }, { level: 1 });
}

export function decodePackage(bytes) {
    let files;
    try { files = unzipSync(bytes); }
    catch (error) { throw packageError('invalid_package', {}, error); }
    const manifest = readJson(files, 'manifest.json');
    requirePackage(manifest && typeof manifest === 'object');
    let data;
    if (manifest.version === 2) data = decodeLegacyV2(files, manifest);
    else if (manifest.version === VERSION) {
        requirePackage(manifest.format === FORMAT);
        for (const rows of [manifest.chunks, manifest.states, manifest.events]) assertUniqueRows(rows);
        const chunks = decodeVectors(files['chunks.bin'], manifest.chunks.length, manifest.dims);
        const states = decodeVectors(files['states.bin'], manifest.states.length, manifest.dims);
        const relations = decodeVectors(files['relations.bin'], manifest.states.filter(row => row.relationHash !== null).length, manifest.dims);
        const events = decodeVectors(files['events.bin'], manifest.events.length, manifest.dims);
        let relationIndex = 0;
        data = {
            chatId: manifest.chatId, fingerprint: manifest.fingerprint, dims: manifest.dims,
            chunks: manifest.chunks.map((row, i) => ({ ...row, vector: chunks[i] })),
            states: manifest.states.map((row, i) => ({ ...row, vector: states[i], rVector: row.relationHash !== null ? relations[relationIndex++] : null })),
            events: manifest.events.map((row, i) => ({ ...row, vector: events[i] })),
            warningCodes: [],
        };
    } else throw packageError('unsupported_version', { version: manifest.version });
    validatePackage(data);
    return data;
}
