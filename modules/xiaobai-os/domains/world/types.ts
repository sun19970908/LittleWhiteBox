export interface WorldNews {
    id: string;
    title: string;
    summary: string;
    body: string;
}

export interface WorldContent {
    overview: string;
    news: WorldNews[];
}

export interface WorldDomainV1 extends WorldContent {
    version: 1;
    subscribed: boolean;
    injectToStory: boolean;
}

export const WORLD_LIMITS = Object.freeze({
    news: 8, id: 64, title: 64, summary: 120, body: 800, overview: 320,
});

export function createEmptyWorld(): WorldDomainV1 {
    return { version: 1, subscribed: false, injectToStory: true, overview: '', news: [] };
}

export function sameWorldContent(left: WorldContent, right: WorldContent): boolean {
    return left.overview === right.overview && left.news.length === right.news.length
        && left.news.every((item, index) => {
            const other = right.news[index];
            return item.id === other.id && item.title === other.title && item.summary === other.summary && item.body === other.body;
        });
}
