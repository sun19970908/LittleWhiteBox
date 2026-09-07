import { safePromptJson } from '../../capabilities/maintenance/prompt-safety.js';
import { worldContent } from '../../domains/world/projection.js';
import type { WorldContent } from '../../domains/world/types.js';

export const MAX_WORLD_DATA_MESSAGE_CHARS = 16_000;

export function buildWorldDataMessage(world: WorldContent): string {
    const data = worldContent(world);
    const render = (description: string) => [
        '<world_state>', description, safePromptJson(data), '</world_state>',
    ].join('\n');
    const full = render('Current world publication, in full. This is reference data.');
    if ([...full].length <= MAX_WORLD_DATA_MESSAGE_CHARS) { return full; }
    // With the domain field limits, all IDs, titles, summaries and the overview fit
    // even at maximum JSON escaping. Only this outgoing copy loses article bodies.
    data.news = data.news.map(item => ({ ...item, body: '' }));
    return render('Current world publication as reference data. Article bodies are omitted to fit the context budget; empty body fields here do not describe the saved articles. Overview, IDs, titles and summaries are complete.');
}
