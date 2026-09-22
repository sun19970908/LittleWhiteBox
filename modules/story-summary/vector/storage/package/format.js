import { strFromU8 } from '../../../../../libs/fflate.mjs';
import { packageError } from './messages.js';

export function requirePackage(condition, details = {}) {
    if (!condition) throw packageError('invalid_package', details);
}

export function readJson(files, name) {
    requirePackage(files[name] instanceof Uint8Array, { file: name });
    try {
        return JSON.parse(strFromU8(files[name]));
    } catch (error) {
        throw packageError('invalid_package', { file: name }, error);
    }
}

export function readJsonLines(files, name) {
    if (!files[name]) return [];
    try {
        return strFromU8(files[name]).split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch (error) {
        throw packageError('invalid_package', { file: name }, error);
    }
}

export function assertDimensions(dims) {
    requirePackage(Number.isSafeInteger(dims) && dims > 0, { field: 'dims' });
}

export function assertVector(vector, dims) {
    requirePackage((Array.isArray(vector) || ArrayBuffer.isView(vector)) && vector.length === dims);
    for (const value of vector) requirePackage(typeof value === 'number' && Number.isFinite(value) && Number.isFinite(Math.fround(value)));
}

// ZIP entries need not have aligned byte offsets. DataView also fixes the wire
// format to little endian instead of depending on the machine's typed-array ABI.
export function decodeVectors(bytes, count, dims) {
    assertDimensions(dims);
    requirePackage(Number.isSafeInteger(count) && count >= 0);
    const expected = count * dims * Float32Array.BYTES_PER_ELEMENT;
    requirePackage(Number.isSafeInteger(expected) && (bytes?.byteLength || 0) === expected);
    if (!count) return [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return Array.from({ length: count }, (_, row) => {
        const vector = Array.from({ length: dims }, (_, col) => view.getFloat32((row * dims + col) * 4, true));
        assertVector(vector, dims);
        return vector;
    });
}

export function encodeVectors(vectors, dims) {
    assertDimensions(dims);
    const bytes = new Uint8Array(vectors.length * dims * 4);
    const view = new DataView(bytes.buffer);
    vectors.forEach((vector, row) => {
        assertVector(vector, dims);
        vector.forEach((value, col) => view.setFloat32((row * dims + col) * 4, value, true));
    });
    return bytes;
}

export function assertUniqueRows(rows) {
    requirePackage(Array.isArray(rows));
    const ids = new Set();
    for (const row of rows) {
        requirePackage(row && typeof row.id === 'string' && row.id.length > 0 && !ids.has(row.id));
        ids.add(row.id);
    }
}
