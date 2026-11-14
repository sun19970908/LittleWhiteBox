import { inputDigest } from '../utils/vector-input-digest.js';
import { buildRAggregateText } from './state-vector-input.js';
import { matchesVectorSource } from '../utils/vector-source.js';

function hasValidVectorPair(item) {
    const vectorValid = typeof item?.vectorValid === 'boolean'
        ? item.vectorValid
        : item?.vector?.length > 0;
    const rVectorValid = typeof item?.rVectorValid === 'boolean'
        ? item.rVectorValid
        : item?.rVector?.length > 0;
    return vectorValid && rVectorValid;
}

export function selectMissingStateVectorAtoms(atoms, stateVectors, fingerprint) {
    const currentFingerprint = String(fingerprint || '');
    const byId = new Map((stateVectors || []).map(item => [item.atomId, item]));
    return (Array.isArray(atoms) ? atoms : [])
        .filter(atom => {
            const vector = byId.get(atom?.atomId);
            return atom?.atomId && (!vector || vector.fingerprint !== currentFingerprint || !hasValidVectorPair(vector)
                || !matchesVectorSource(vector, { floor: atom.floor, sourceHash: inputDigest('state', atom.semantic),
                    relationHash: inputDigest('relation', buildRAggregateText(atom)) }));
        });
}

export function canRepairStateVectors(metaFingerprint, currentFingerprint) {
    const stored = String(metaFingerprint || '');
    return !stored || stored === String(currentFingerprint || '');
}
