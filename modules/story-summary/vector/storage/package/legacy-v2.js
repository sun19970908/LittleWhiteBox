// Compatibility: ZIP v2 emitted by upstream's original vector exporter. Read only at import;
// remove this adapter when support for existing v2 backups is retired explicitly.
// Its input layout is frozen by the actual exporter fixture in tests/fixtures.
import { readJson, readJsonLines, decodeVectors, requirePackage, assertUniqueRows } from './format.js';
import { inputDigest } from '../../utils/vector-input-digest.js';

// Frozen v2 relation input rule, not the current runtime type/implementation.
function v2RelationInput(atom) {
    const relations = new Set((atom.edges || []).map(edge => String(edge?.r || '').trim()).filter(Boolean));
    const joined = [...relations].join(' ; ');
    return joined ? joined.slice(0, 256) : String(atom.semantic || '').trim();
}

export function decodeLegacyV2(files, manifest) {
    const chunks = readJsonLines(files, 'chunks.jsonl');
    const states = readJsonLines(files, 'state_vectors.jsonl');
    const events = readJsonLines(files, 'events.jsonl');
    const atoms = files['state_atoms.json'] ? readJson(files, 'state_atoms.json') : [];
    requirePackage(Array.isArray(atoms));
    requirePackage(atoms.every(atom => atom && typeof atom === 'object'));
    requirePackage(chunks.every(row => row && typeof row === 'object'));
    requirePackage(states.every(row => row && typeof row === 'object'));
    requirePackage(manifest.chunkCount === chunks.length && manifest.chunkVectorCount === chunks.length);
    requirePackage(manifest.eventCount === events.length && manifest.stateVectorCount === states.length);
    const chunkVectors = decodeVectors(files['chunk_vectors.bin'], chunks.length, manifest.dims);
    const stateVectors = decodeVectors(files['state_vectors.bin'], states.length, manifest.dims);
    decodeVectors(files['event_vectors.bin'], events.length, manifest.dims);
    const relationVectors = files['state_r_vectors.bin']?.byteLength
        ? decodeVectors(files['state_r_vectors.bin'], states.length, manifest.rDims)
        : [];
    const atomRows = atoms.map(atom => ({ ...atom, id: atom.atomId }));
    assertUniqueRows(atomRows);
    const byId = new Map(atomRows.map(atom => [atom.id, atom]));
    const stateRows = states.map((row, index) => {
        const atom = byId.get(row.atomId);
        requirePackage(atom && typeof atom.semantic === 'string' && atom.floor === row.floor);
        requirePackage(typeof row.hasRVector === 'boolean');
        if (row.hasRVector) requirePackage(relationVectors.length === states.length && manifest.rDims === manifest.dims && row.rDims === manifest.dims);
        return {
            id: row.atomId, floor: row.floor,
            sourceHash: inputDigest('state', atom.semantic),
            relationHash: row.hasRVector ? inputDigest('relation', v2RelationInput(atom)) : null,
            vector: stateVectors[index], rVector: row.hasRVector ? relationVectors[index] : null,
        };
    });
    return {
        chatId: manifest.chatId, fingerprint: manifest.fingerprint, dims: manifest.dims,
        chunks: chunks.map((row, index) => {
            requirePackage(typeof row.text === 'string');
            return { id: row.chunkId, floor: row.floor, index: row.chunkIdx, sourceHash: inputDigest('chunk', row.text), vector: chunkVectors[index] };
        }),
        states: stateRows,
        // v2 only exported eventId. Never label an unproven vector with a hash
        // computed from today's event, which could have been edited since export.
        events: [],
        warningCodes: events.length ? ['legacy_events_omitted'] : [],
    };
}
