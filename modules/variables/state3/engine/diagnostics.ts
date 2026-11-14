import type { Diagnostic } from '../types.js';
import { errorDetails } from '../../../../shared/common/error-details.js';
export class SettlementError extends Error {
    constructor(public code: string, public details: Record<string, unknown> = {}) {
        super(code);
        this.name = 'SettlementError';
    }
}
export function reject(code: string, details?: Record<string, unknown>): never { throw new SettlementError(code, details); }
export function diagnostic(error: unknown): Diagnostic {
    if (error instanceof SettlementError) {return { code: error.code, ...error.details };}
    return { code: 'execution', ...errorDetails(error) } as Diagnostic;
}
