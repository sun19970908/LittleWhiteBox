import { sha256 } from '../../../../../../../../lib.js';

// Captured from the actual embedding request, not reconstructed at export.
// Lives with its vector record and is removed/replaced with that record.
export function inputDigest(kind, text) {
    return sha256(JSON.stringify([kind, text]));
}
