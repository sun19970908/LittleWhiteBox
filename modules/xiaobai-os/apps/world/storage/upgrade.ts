import { parseWorld, record, worldText, WorldValidationError } from '../../../domains/world/invariants.js';
import { WORLD_VERSION, type WorldDomain } from '../../../domains/world/types.js';

// Frozen upstream v1/v2 file formats. Keep until these OS chat files are no
// longer supported. They share article fields and limits, not the current model.
interface WorldFileContentV1V2 {
    overview: string;
    news: { id: string; title: string; summary: string; body: string }[];
}

interface WorldFileV1 extends WorldFileContentV1V2 {
    version: 1;
    subscribed: boolean;
    injectToStory: boolean;
}

interface WorldFileV2 extends WorldFileContentV1V2 {
    version: 2;
}

function parseContentV1V2(item: Record<string, unknown>): WorldFileContentV1V2 {
    if (!Array.isArray(item.news) || item.news.length > 8) {
        throw new WorldValidationError('world.news', 'Expected up to 8 news items.');
    }
    const news = item.news.map((value, index) => {
        const path = `world.news[${index}]`;
        const entry = record(value, path, ['id', 'title', 'summary', 'body']);
        return {
            id: worldText(entry.id, `${path}.id`, 64),
            title: worldText(entry.title, `${path}.title`, 64),
            summary: worldText(entry.summary, `${path}.summary`, 120),
            body: worldText(entry.body, `${path}.body`, 800),
        };
    });
    if (new Set(news.map(entry => entry.id)).size !== news.length) {
        throw new WorldValidationError('world.news', 'Duplicate news IDs.');
    }
    return { overview: worldText(item.overview, 'world.overview', 320, true), news };
}

function parseV1(value: unknown): WorldFileV1 {
    const item = record(value, 'world', ['version', 'subscribed', 'injectToStory', 'overview', 'news']);
    if (item.version !== 1 || typeof item.subscribed !== 'boolean' || typeof item.injectToStory !== 'boolean') {
        throw new WorldValidationError('world', 'Invalid version 1 world file.');
    }
    return { version: 1, subscribed: item.subscribed, injectToStory: item.injectToStory,
        ...parseContentV1V2(item) };
}

function parseV2(value: unknown): WorldFileV2 {
    const item = record(value, 'world', ['version', 'overview', 'news']);
    if (item.version !== 2) { throw new WorldValidationError('world', 'Invalid version 2 world file.'); }
    return { version: 2, ...parseContentV1V2(item) };
}

export function readWorldFile(value: unknown): WorldDomain {
    const version = value !== null && typeof value === 'object' ? (value as { version?: unknown }).version : undefined;
    if (version === 1 || version === 2) {
        const previous = version === 1 ? parseV1(value) : parseV2(value);
        // Retain the complete article, discard the redundant summary. V1 chat
        // preferences are deliberately not promoted to global preferences.
        return parseWorld({ version: WORLD_VERSION, overview: previous.overview,
            news: previous.news.map(({ id, title, body }) => ({ id, title, body })) });
    }
    return parseWorld(value);
}
