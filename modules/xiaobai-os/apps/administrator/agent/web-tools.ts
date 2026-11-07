import { getWebSearchToolDefinition, getWebFetchToolDefinition, runWebSearchTool, runWebFetchTool, WEB_SEARCH_TOOL_NAME, WEB_FETCH_TOOL_NAME } from '../../../../agent-core/web/tools.js';
import { isWebConfigured } from '../../../../agent-core/web/settings.js';
import type { ManagementTool, ManagementResult } from '../../../capabilities/management/index.js';
import { ADMINISTRATOR_COPY } from '../ui/copy.js';
import { withPagedToolResult } from '../../../../agent-core/runtime/tool-result-contract.js';

export function createAdministratorWebTools(config: Record<string, unknown> = {}, signal?: AbortSignal) {
    const tools: ManagementTool[] = isWebConfigured(config) ? [
        { definition: getWebSearchToolDefinition(), effect: 'read', label: ADMINISTRATOR_COPY.webSearch,
            target: (args: Record<string, unknown>) => String(args.query ?? '') },
        { definition: getWebFetchToolDefinition(), effect: 'read', label: ADMINISTRATOR_COPY.webFetch,
            target: (args: Record<string, unknown>) => Array.isArray(args.urls) ? args.urls.join(', ') : '' },
    ].map(tool => ({ ...tool, definition: withPagedToolResult({ ...tool.definition, function: { ...tool.definition.function,
        description: `${tool.definition.function.description}\nThe web result fields are returned in data, alongside the administrator operation status and receipt.`,
    } }) })) as ManagementTool[] : [];
    return {
        tools,
        owns: (name: string) => name === WEB_SEARCH_TOOL_NAME || name === WEB_FETCH_TOOL_NAME,
        async execute(name: string, args: Record<string, unknown>): Promise<ManagementResult> {
            const data = await (name === WEB_SEARCH_TOOL_NAME ? runWebSearchTool : runWebFetchTool)(config, args, { signal });
            return { ok: data.ok, status: data.ok ? 'read' : 'results' in data && data.results.length ? 'partial' : 'failed',
                ...('error' in data ? { code: data.error } : {}), data };
        },
    };
}
