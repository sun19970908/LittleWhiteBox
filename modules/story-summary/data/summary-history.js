import { normalizeSummaryUndo } from './summary-undo.js';
import { validateMaintenanceReceipt, upgradeMaintenanceReceipt } from '../maintenance/history.js';
import { isMemoryPolicy } from './memory-policy.js';

function valid(condition) {
    if (!condition) throw Object.assign(new Error('summary_history_invalid'), { code: 'summary_history_invalid' });
}

export function createSummaryBaseline(endMesId) {
    valid(Number.isInteger(endMesId) && endMesId >= 0);
    return { format: 2, kind: 'baseline', endMesId, maintenance: [] };
}

export function createSummaryBatch(previousEndMesId, endMesId, undo, policy) {
    const normalized = normalizeSummaryUndo(undo);
    valid(normalized && Number.isInteger(previousEndMesId) && previousEndMesId >= -1
        && Number.isInteger(endMesId) && previousEndMesId < endMesId);
    valid(policy === undefined || isMemoryPolicy(policy));
    return { format: 2, kind: 'batch', previousEndMesId, endMesId, undo: normalized, maintenance: [], ...(policy ? { policy: structuredClone(policy) } : {}) };
}

/**
 * Upstream boundary-only history and v1 exact batches are converted once on metadata load.
 * Boundary-only entries have no inverse: retain only their latest starting boundary, never guess undo.
 * Remove these adapters when those upstream file formats are no longer supported.
 */
export function upgradeSummaryHistory(history) {
    if (history == null) return { value: [], changed: false };
    valid(Array.isArray(history));
    const value = [];
    for (const entry of history) {
        valid(entry && Number.isInteger(entry.endMesId) && entry.endMesId >= 0);
        if (entry.format == null) {
            valid(!Object.hasOwn(entry, 'undo') && !Object.hasOwn(entry, 'previousEndMesId'));
            value.length = 0;
            value.push(createSummaryBaseline(entry.endMesId));
        } else if (entry.format === 1) {
            value.push(createSummaryBatch(entry.previousEndMesId, entry.endMesId, entry.undo));
        } else {
            valid(entry.format === 2 && ['baseline', 'batch'].includes(entry.kind) && Array.isArray(entry.maintenance));
            if (entry.kind === 'baseline') valid(!value.length && entry.undo == null && entry.previousEndMesId == null);
            else createSummaryBatch(entry.previousEndMesId, entry.endMesId, entry.undo, entry.policy);
            value.push({ ...entry, maintenance: entry.maintenance.map(upgradeMaintenanceReceipt) });
        }
    }
    // An exact imported/truncated history can name an earlier boundary without
    // carrying its batches. That named starting state is not itself reversible.
    if (value[0]?.kind === 'batch' && value[0].previousEndMesId >= 0) value.unshift(createSummaryBaseline(value[0].previousEndMesId));
    for (let i = 1; i < value.length; i++) {
        valid(value[i].kind === 'batch' && value[i].previousEndMesId === value[i - 1].endMesId);
    }
    return { value, changed: JSON.stringify(value) !== JSON.stringify(history) };
}

export function appendMaintenanceReceipt(store, receipt, boundary = store.lastSummarizedMesId) {
    validateMaintenanceReceipt(receipt);
    const batch = store.summaryHistory?.find(entry => entry.endMesId === boundary);
    valid(batch);
    batch.maintenance.push(receipt);
}

export function getRollbackOnceTargetEndMesId(store) {
    if (store?.summaryInvalid) return null;
    const current = store?.summaryHistory?.find(entry => entry.endMesId === store.lastSummarizedMesId);
    if (!current) return null;
    if (current.kind === 'baseline') return current.maintenance.length ? current.endMesId : null;
    valid(current.kind === 'batch' && normalizeSummaryUndo(current.undo));
    return current.previousEndMesId;
}
