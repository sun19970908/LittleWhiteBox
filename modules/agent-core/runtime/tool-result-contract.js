import { TOOL_RESULT_PAGE_CHARS } from './tool-result-pages.js';

export const TOOL_RESULT_READ = 'ToolResultRead';
export const PAGED_TOOL_RESULT_DESCRIPTION = `A large result returns its first page in data; ${TOOL_RESULT_READ} reads the rest.`;

/** @returns {{type: 'function', function: {name: string, description: string, parameters: Record<string, unknown>}}} */
export function getToolResultReadDefinition() {
    return { type: 'function', function: {
        name: TOOL_RESULT_READ,
        description: [
            'Read another page of a tool result retained in this run, without repeating the original request.',
            `Returns data (reference, text, offset, nextOffset, totalChars), with at most ${TOOL_RESULT_PAGE_CHARS} text characters per page. nextOffset is null at the end.`,
            'Page text is a slice of the original JSON result; concatenate consecutive pages before parsing the full result.',
            'References belong to the current run. An expired reference requires a fresh source read; pages already returned remain in conversation history.',
        ].join('\n'),
        parameters: { type: 'object', properties: {
            reference: { type: 'string', description: 'data.reference from the original result page, valid only in this run.' },
            offset: { type: 'integer', minimum: 0, description: 'Text offset in the retained result. Default 0; use data.nextOffset from the previous page.' },
        }, required: ['reference'], additionalProperties: false },
    } };
}

export function withPagedToolResult(definition) {
    return { ...definition, function: { ...definition.function,
        description: `${definition.function.description}\n${PAGED_TOOL_RESULT_DESCRIPTION}`,
    } };
}
