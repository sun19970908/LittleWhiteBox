import { COPY } from './copy.js';
export const CARD_ROOT = 'local/cards/';
export const rootFor = avatar => `${CARD_ROOT}${encodeURIComponent(avatar)}/`;

function mapCardSegments(path, transform) {
    const segments = path.split('/');
    if (!path.startsWith(CARD_ROOT)) return segments;
    // Only these components are URI-encoded by the card projection. Other
    // workspace names (including authored files inside a card) are literal.
    const encodedIndices = [2];
    if (['world_book', 'regex', 'tasks'].includes(segments[3])) encodedIndices.push(4);
    if (segments[3] === 'world_book' && segments.length === 6) encodedIndices.push(5);
    for (const index of encodedIndices) {
        if (!segments[index]) continue;
        segments[index] = transform(segments[index]);
    }
    return segments;
}

function decodeName(segment) {
    try {
        return decodeURIComponent(segment);
    } catch (error) {
        if (!(error instanceof URIError)) throw error;
        // A manually created, non-URI name must still be displayable.
        return segment;
    }
}

// Public paths keep Unicode and spaces readable, but preserve separators and
// literal percent signs as escapes so that distinct names remain distinct.
export function readableCardWorkspacePath(path) {
    return mapCardSegments(path, segment => decodeName(segment)
        .replace(/[%/\\\x00-\x1f\x7f]/g, character => encodeURIComponent(character)).replace(/\.\./g, '%2E%2E')).join('/');
}

// Existing fully encoded paths obey this same grammar; no aliases or migration.
export function storedCardWorkspacePath(path) {
    return mapCardSegments(path, segment => encodeURIComponent(decodeURIComponent(segment)).replace(/\.\./g, '%2E%2E')).join('/');
}

export function readableCardWorkspaceRelativePath(path, relativePath) {
    if (!path.endsWith(relativePath)) return relativePath;
    const prefix = path.slice(0, path.length - relativePath.length);
    return readableCardWorkspacePath(path).slice(readableCardWorkspacePath(prefix).length);
}

export function displayCardWorkspacePath(path) {
    return mapCardSegments(path, decodeName).join('/');
}

export function displayCardWorkspaceName(path, fallback) {
    if (path.replace(/\/$/, '') === 'local/cards') return COPY.folders.cards;
    if (!path.startsWith(CARD_ROOT)) return fallback;
    const segments = mapCardSegments(path.replace(/\/$/, ''), decodeName);
    const name = segments.at(-1);
    if (segments[3] === 'variables' && segments.length <= 5) return COPY.variableFiles[name] || name;
    if (segments.length === 4) return COPY.folders[name] || COPY.fields[name] || name;
    if (segments[3] === 'message' && /^\d+\.md$/.test(name)) return COPY.greeting(Number(name.slice(0, -3)));
    if (['regex', 'tasks', 'world_book'].includes(segments[3]) && name.endsWith('.md')) return name.slice(0, -3);
    return name;
}
