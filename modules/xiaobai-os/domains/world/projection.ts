import type { WorldContent } from './types.js';

export function worldContent(world: WorldContent): WorldContent {
    return { overview: world.overview, news: world.news.map(item => ({ ...item })) };
}
