import type { ManagementTool } from '../../../capabilities/management/index.js';
import { MANAGEMENT_READ_CHARS } from '../../../capabilities/management/read-page.js';

const floor = { type: 'integer', minimum: 0, description: 'SillyTavern floor number, counted from 0 without renumbering.' };
export const ADMINISTRATOR_CHAT_TOOLS: readonly ManagementTool[] = [
    { effect: 'read', label: '搜索原文', target: a => String(a.query ?? ''), definition: { type: 'function', function: {
        name: 'ChatSearch', description: 'Search the currently selected story messages for a literal case-insensitive phrase. data contains items (floor, speaker, snippet, offset), next (continuation arguments) and complete. Returns the first match in each floor, up to 20 floors per call; system messages are excluded. A miss means the phrase was not found, not that the event never happened.',
        parameters: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 200, description: 'One name, object name or short phrase. Spaces and punctuation match literally. Search separate clues separately; if no match, shorten or reword the phrase.' }, from: { ...floor, description: 'Inclusive start floor, default 0.' }, to: { ...floor, description: 'Inclusive end floor, default last floor.' } }, required: ['query'], additionalProperties: false },
    } } },
    { effect: 'read', label: '读取原文', target: a => `#${a.from}${a.to !== undefined && a.to !== a.from ? `–#${a.to}` : ''}`, definition: { type: 'function', function: {
        name: 'ChatRead', description: `Read the currently selected story messages in an inclusive floor range. data contains items (floor, speaker, role, text, offset, totalChars), scanned (covered range), omittedSystemFloors, next (continuation arguments) and complete. At most ${MANAGEMENT_READ_CHARS} text characters and 20 floors per call. Continuation requires the same floor version; after an edit or swipe change, read that floor again from offset 0.`,
        parameters: { type: 'object', properties: { from: floor, to: { ...floor, description: 'Inclusive end floor, default from.' }, offset: { type: 'integer', minimum: 0, description: 'Text offset within the starting floor, default 0. Use the returned continuation offset.' } }, required: ['from'], additionalProperties: false },
    } } },
];
