import type { XiaobaiOsAgentSession } from '../../../../capabilities/agent/gateway.js';
import { fault } from '../random.js';

/** Only the provider's structured capacity rejection can authorize a smaller replacement request. */
export async function runNarrativeRequest(session: XiaobaiOsAgentSession, request: Parameters<XiaobaiOsAgentSession['run']>[0]) {
    try { return await session.run(request); }
    catch (error) {
        if (request.signal?.aborted) { fault('cancelled', error); }
        const rejection = error as { code?: unknown; error?: { code?: unknown } } | null;
        if (rejection?.code === 'context_length_exceeded' || rejection?.error?.code === 'context_length_exceeded') { fault('context_capacity', error); }
        const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
        fault(status === 401 || status === 403 ? 'agent_auth' : 'agent_failed', error);
    }
}
