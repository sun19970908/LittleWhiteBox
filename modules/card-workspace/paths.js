export const CARD_ROOT = 'local/cards/';
export const rootFor = avatar => `${CARD_ROOT}${encodeURIComponent(avatar)}/`;

function mapCardSegments(path, transform) {
    const segments = path.split('/');
    if (!path.startsWith(CARD_ROOT)) return segments;
    // Only these components are URI-encoded by the card projection. Other
    // workspace names (including authored files inside a card) are literal.
    const encodedIndices = [2];
    if (['world_book', 'regex', 'tasks'].includes(segments[3])) encodedIndices.push(4);
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
        .replace(/[%/\\\x00-\x1f\x7f]/g, character => encodeURIComponent(character))).join('/');
}

// Existing fully encoded paths obey this same grammar; no aliases or migration.
export function storedCardWorkspacePath(path) {
    return mapCardSegments(path, segment => encodeURIComponent(decodeURIComponent(segment))).join('/');
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
    if (!path.startsWith(CARD_ROOT)) return fallback;
    return mapCardSegments(path.replace(/\/$/, ''), decodeName).at(-1);
}
