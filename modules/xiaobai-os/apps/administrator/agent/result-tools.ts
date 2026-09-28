import type { ManagementTool } from '../../../capabilities/management/index.js';
import { MANAGEMENT_READ_CHARS } from '../../../capabilities/management/read-page.js';
import { ADMINISTRATOR_COPY } from '../ui/copy.js';

export const TOOL_RESULT_READ = 'ToolResultRead';
export const ADMINISTRATOR_RESULT_READ: ManagementTool = {
    effect: 'read', label: ADMINISTRATOR_COPY.evidence, target: args => String(args.reference ?? ''),
    definition: { type: 'function', function: {
        name: TOOL_RESULT_READ,
        description: [
            'Read the remaining pages of a large tool result from this run.',
            `data contains reference, text, offset, nextOffset and totalChars, with at most ${MANAGEMENT_READ_CHARS} text characters per page.`,
            'When a result provides data.reference, use it here and follow nextOffset until null to finish reading that result.',
            'The pages belong to the result already returned. Use the original tool for fresh source data or for a continuation found inside that result.',
            'If a result has detailsUnavailable and totalChars, its full body was too large to retain. An expired reference also needs a fresh read from the original source in smaller pages.',
        ].join('\n'),
        parameters: { type: 'object', properties: {
            reference: { type: 'string', description: 'data.reference from the original result page, valid only in this run.' },
            offset: { type: 'integer', minimum: 0, description: 'Text offset in the retained result. Default 0; use data.nextOffset from the previous page.' },
        }, required: ['reference'], additionalProperties: false },
    } },
};
