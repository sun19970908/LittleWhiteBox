export interface WorldNews {
    id: string;
    title: string;
    body: string;
}

export interface WorldContent {
    overview: string;
    news: WorldNews[];
}

export const WORLD_VERSION = 3;

export interface WorldDomain extends WorldContent {
    version: typeof WORLD_VERSION;
}

// Keep the upstream storage bound until existing long articles are explicitly
// migrated. Reading or saving unrelated news must not truncate their content.
export const WORLD_LIMITS = Object.freeze({
    news: 8, id: 64, title: 64, body: 800, overview: 320,
});

// Authoring limits are stricter than stored-content bounds: upstream articles
// remain readable without truncation, while every new or replacement body is brief.
export const WORLD_WRITE_LIMITS = Object.freeze({ ...WORLD_LIMITS, body: 300 });

export function createEmptyWorld(): WorldDomain {
    return { version: WORLD_VERSION, overview: '', news: [] };
}

export function sameWorldContent(left: WorldContent, right: WorldContent): boolean {
    return left.overview === right.overview && left.news.length === right.news.length
        && left.news.every((item, index) => {
            const other = right.news[index];
            return item.id === other.id && item.title === other.title && item.body === other.body;
        });
}
