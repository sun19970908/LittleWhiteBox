import type { XiaobaiOsStoragePort } from '../kernel/contracts.js';
import { createStorageId } from '../kernel/identity.js';

// Upstream a32c28d0 and earlier stored these economic assets in each chat.
// User-authorized discard, not a merge. Remove this upgrade when those sidecars are no longer supported.
const RETIRED_PARTITIONS = ['economy', 'bank', 'game', 'shop', 'tasks'] as const;

export function resetLegacyChatEconomy(storage: XiaobaiOsStoragePort): XiaobaiOsStoragePort {
    return {
        ...storage,
        async read(osId, signal) {
            const original = await storage.read(osId, signal);
            if (!original || !RETIRED_PARTITIONS.some(key => Object.hasOwn(original.partitions, key))) { return original; }
            const candidate = structuredClone(original);
            for (const key of RETIRED_PARTITIONS) { delete candidate.partitions[key]; }
            candidate.revision++;
            candidate.commitId = createStorageId();
            const saved = await storage.replace({ expected: { osId, revision: original.revision, commitId: original.commitId }, candidate }, signal);
            if (saved.status !== 'confirmed') {
                throw Object.assign(new Error('Legacy chat economy cleanup is not confirmed'), { code: `storage_${saved.status}` });
            }
            return candidate;
        },
    };
}
