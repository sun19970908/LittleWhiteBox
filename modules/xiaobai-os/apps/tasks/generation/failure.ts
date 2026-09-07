import { classifyProviderFailure } from '../../../capabilities/agent/provider-failure.js';

export function taskGenerationFailureReason(error: unknown): string {
    const value = error && typeof error === 'object'
        ? error as { saveStatus?: unknown; message?: unknown } : {};
    switch (value.saveStatus) {
        case 'unconfirmed': return 'save-unconfirmed';
        case 'conflict': return 'save-conflict';
        case 'failed': return 'save-failed';
    }
    switch (value.message) {
        case 'tasks_agent_not_configured': return 'agent-not-configured';
        case 'tasks_config_load_failed': return 'config-load-failed';
        case 'tasks_agent_session_failed': return 'agent-session-failed';
        case 'tasks_context_failed': return 'background-capture-failed';
        default: return classifyProviderFailure(error);
    }
}
