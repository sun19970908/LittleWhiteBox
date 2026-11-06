export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export interface AgentToolCall {
    id: string;
    name: string;
    arguments: string;
    /** Empty string denotes a provider call without its own ID (not an omitted internal ID). */
    providerId?: string;
}
export interface AgentToolDefinition {
    type: 'function';
    function: { name: string; description?: string; parameters: JsonObject };
}
export interface AgentAssistantReply {
    role: 'assistant';
    content: string;
    providerPayload?: JsonObject;
    tool_calls: {
        id: string;
        type: 'function';
        providerToolCallId?: string;
        function: { name: string; arguments: string };
    }[];
}
export interface AgentToolResult {
    role: 'tool';
    tool_call_id: string;
    toolName: string;
    /** A serialized JSON object; non-object JSON results are wrapped in { result }. */
    content: string;
}
export type AgentHistoryMessage = AgentAssistantReply | AgentToolResult | {
    role: 'system' | 'assistant';
    content: string;
    providerPayload?: JsonObject;
} | {
    role: 'user';
    content: string | JsonObject[];
    providerPayload?: JsonObject;
};
export interface AgentStreamDraft {
    activity?: 'waiting' | 'thinking' | 'tool-call' | 'replying';
    text?: string;
    thoughts?: { label: string; text: string }[];
    toolCalls?: AgentToolCall[];
    /** Stream calls are provisional; use the final result before executing tools. */
    toolCallDraft: true;
}
export interface AgentChatInput {
    systemPrompt?: string;
    /** Full caller-owned canonical history. Append reply and toolResult for the next round. */
    messages: AgentHistoryMessage[];
    tools?: AgentToolDefinition[];
    toolChoice?: 'auto' | 'required' | 'none';
    signal?: AbortSignal;
    onStreamProgress?: (draft: AgentStreamDraft) => void;
}
export interface AgentChatResult {
    text: string;
    thoughts: { label: string; text: string }[];
    toolCalls: AgentToolCall[];
    reply: AgentAssistantReply;
    provider: string;
    model: string;
    usage?: JsonValue;
    finishReason?: string | null;
    completion?: 'complete' | 'incomplete';
    truncated?: boolean;
}
export interface PublicAgentSession {
    chat(input: AgentChatInput): Promise<AgentChatResult>;
    toolResult(call: AgentToolCall, value: JsonValue): AgentToolResult;
    /** Permanently closes this session and aborts its active request. */
    dispose(): void;
}
export interface PublicAgentStatus {
    enabled: boolean;
    main: { configured: boolean; provider: string; model: string };
    delegate: { configured: boolean; provider: string; model: string };
    web: { configured: boolean; provider: string };
}
export interface WebSearchInput { query: string; maxResults?: number; signal?: AbortSignal }
export interface WebFetchInput { urls: string[]; signal?: AbortSignal }
export interface WebSearchResult {
    ok: true;
    query: string;
    maxResults: number;
    count: number;
    results: JsonObject[];
    summary: string;
}
export interface WebFetchResult {
    /** False for partial extraction; successful pages remain in results. Transport failures throw. */
    ok: boolean;
    provider: string;
    requestId?: string;
    results: JsonObject[];
    failures: { url: string; code: string; httpStatus?: number; message?: string }[];
    failedUrls: string[];
}
export interface PublicAgentApi {
    getStatus(): Promise<PublicAgentStatus>;
    openSession(options?: { api?: 'main' | 'delegate'; signal?: AbortSignal }): Promise<PublicAgentSession>;
    web: {
        getTools(): AgentToolDefinition[];
        search(input: WebSearchInput): Promise<WebSearchResult>;
        fetch(input: WebFetchInput): Promise<WebFetchResult>;
    };
}
export interface PublicAgentError extends Error { code: string; status?: number }
declare global {
    interface Window { xiaobaixAgent: PublicAgentApi }
}
export interface PublicAgentDependencies {
    isEnabled(): boolean;
    /** Returns normalized shared settings. Called once per session, separately for each web call. */
    loadSettings(): Promise<object> | object;
    /** The existing lazy agent-core loader; the factory shares its resolved module across sessions. */
    loadCore(): Promise<{ createAgentAdapter(config: object): { chat(task: object): Promise<object> } }>;
}
export function createPublicAgentApi(dependencies: PublicAgentDependencies): {
    api: PublicAgentApi;
    /** Host-only: permanently invalidates old sessions/requests without replacing the public facade. */
    cancelAll(): void;
};
