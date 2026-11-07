import type { ManagementTool } from '../../../capabilities/management/index.js';
import { getToolResultReadDefinition, TOOL_RESULT_READ } from '../../../../agent-core/runtime/tool-result-contract.js';
import { ADMINISTRATOR_COPY } from '../ui/copy.js';

export { TOOL_RESULT_READ };
const definition = getToolResultReadDefinition();
export const ADMINISTRATOR_RESULT_READ: ManagementTool = {
    effect: 'read', label: ADMINISTRATOR_COPY.evidence, target: args => String(args.reference ?? ''),
    definition: { ...definition, function: { ...definition.function,
        description: `${definition.function.description}\nIf a result has detailsUnavailable and totalChars, its full body was too large to retain. Read the original source in smaller pages.`,
    } },
};
