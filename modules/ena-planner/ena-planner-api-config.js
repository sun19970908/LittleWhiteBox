import { TEXT_API_COPY } from '../text-api/copy.js';
import { HOST_PROVIDER } from '../text-api/model.js';
import { PLANNER_COPY } from './ena-planner-copy.js';
import { VERTEX_PROVIDER, resolveVertexEndpoint } from '../agent-core/vertex-config.js';

export function assertPlannerPresetReady(preset) {
    if (preset?.provider === HOST_PROVIDER) throw new Error(PLANNER_COPY.independentApi);
    if (preset?.provider === VERTEX_PROVIDER) {
        resolveVertexEndpoint(preset);
        return;
    }
    if (!String(preset?.apiKey || '').trim()) throw new Error(TEXT_API_COPY.plannerKey);
}
