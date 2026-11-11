import { createToolResultPages } from '../../../../agent-core/runtime/tool-result-pages.js';
import { safePromptJson } from '../../../capabilities/maintenance/prompt-safety.js';
import { ADMINISTRATOR_POLICY as POLICY } from '../domain/policy.js';

export function createAdministratorToolResults() {
    return createToolResultPages({ budgetChars: POLICY.evidenceChars, serialize: safePromptJson,
        expiredError: 'administrator_evidence_expired', rangeError: 'management_read_range_invalid' });
}
