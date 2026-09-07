export type AgentApiLoadStatus = 'loading' | 'ready' | 'error';

export interface AgentApiClientState {
    status: AgentApiLoadStatus;
    config: Record<string, unknown> | null;
    message: string;
}

export interface AgentApiConnectionResult {
    provider: string;
    model: string;
    latencyMs: number;
}
