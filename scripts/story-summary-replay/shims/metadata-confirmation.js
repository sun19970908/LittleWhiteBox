import assert from 'node:assert/strict';
import { EXT_ID } from '../../../core/constants.js';
import { __getPersistedMetadata } from './extensions.js';

export class MetadataConfirmationError extends Error {
    constructor(code, uncertain = false) { super(code); this.code = code; this.uncertain = uncertain; }
}

// The replay host has no HTTP chat-file server. Its confirmed save snapshot is the readback boundary.
export function createMetadataConfirmation() {
    return async (expected, previous, loadedPrevious) => {
        const actual = __getPersistedMetadata()?.extensions?.[EXT_ID] || {};
        const matches = snapshot => snapshot && Object.entries(snapshot).every(([key, value]) => {
            try { assert.deepEqual(actual[key], value); return true; } catch { return false; }
        });
        if (matches(expected)) return;
        if (matches(previous) || matches(loadedPrevious)) throw new MetadataConfirmationError('metadata_not_saved');
        throw new MetadataConfirmationError('metadata_save_conflict', true);
    };
}
