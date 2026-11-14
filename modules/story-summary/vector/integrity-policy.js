import { SUMMARY_FEEDBACK_COPY } from '../feedback-copy.js';

export const L1_GAP_WARNING_THRESHOLD = 5;
export const L0_GAP_WARNING_THRESHOLD = 5;

export function buildVectorIntegrityIssues({
    fingerprintMismatch = false,
    chunkFloorGap = 0,
    incompleteL0AnchorFloorCount = 0,
    missingL0VectorFloorCount = 0,
    missingEventVectorCount = 0,
    cacheInconsistent = false,
    cacheRepairable = false,
} = {}) {
    const issues = [];
    const copy = SUMMARY_FEEDBACK_COPY.vectorIntegrity;
    if (fingerprintMismatch) {
        issues.push({ code: 'fingerprint_mismatch', action: 'rebuild', message: copy.fingerprintMismatch });
    }
    if (cacheInconsistent) {
        issues.push({ code: 'cache_inconsistent', action: cacheRepairable ? 'fill' : 'rebuild', message: copy.cacheInconsistent });
    }

    const gap = Math.max(0, Math.trunc(Number(chunkFloorGap) || 0));
    if (gap >= L1_GAP_WARNING_THRESHOLD) {
        issues.push({ code: 'l1_gap', action: 'fill', message: copy.l1Gap(gap) });
    }

    const anchorGap = Math.max(0, Math.trunc(Number(incompleteL0AnchorFloorCount) || 0));
    if (anchorGap >= L0_GAP_WARNING_THRESHOLD) {
        issues.push({ code: 'l0_gap', action: 'extract', message: copy.l0Gap(anchorGap) });
    }

    const vectorGap = Math.max(0, Math.trunc(Number(missingL0VectorFloorCount) || 0));
    if (vectorGap >= L0_GAP_WARNING_THRESHOLD) {
        issues.push({ code: 'l0_vectors_missing', action: 'fill', message: copy.l0VectorsMissing(vectorGap) });
    }

    const missingEvents = Math.max(0, Math.trunc(Number(missingEventVectorCount) || 0));
    if (missingEvents > 0) {
        issues.push({ code: 'event_vectors_missing', action: 'fill', message: copy.eventsMissing(missingEvents) });
    }
    return issues;
}
