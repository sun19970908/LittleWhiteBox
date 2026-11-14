import { COPY } from './copy.js';

// One editable document owns the identity, name, settings and body of an item.
// Paths are derived labels; only the document identity selects the saved item.
export const ITEM_KINDS = Object.freeze({
    world: { name: 'comment', body: 'content', language: '.md' },
    regex: { name: 'scriptName', body: 'replaceString', language: '.html' },
    tasks: { name: 'name', body: 'commands', language: '.js' },
});

export function splitItemDocument(content) {
    const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) throw new SyntaxError(COPY.invalidDocument);
    return { header: match[1], body: content.slice(match[0].length), bodyOffset: match[0].length };
}

export const joinItemDocument = (header, body) => `---\n${header}\n---\n${body}`;

export function parseItemDocument(kind, content) {
    const { header, body } = splitItemDocument(content);
    const metadata = JSON.parse(header);
    const validObject = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!validObject(metadata) || !validObject(metadata.settings) || typeof metadata.name !== 'string'
        || Object.keys(metadata).some(key => !['id', 'name', 'settings'].includes(key))) throw new Error(COPY.invalidDocument);
    if (kind === 'world' ? !Number.isSafeInteger(metadata.id) || metadata.id < 0 : typeof metadata.id !== 'string' || !metadata.id.trim()) {
        throw new Error(COPY.invalidIdentity);
    }
    const fields = ITEM_KINDS[kind];
    if (['id', 'uid', fields.name, fields.body].some(key => Object.hasOwn(metadata.settings, key))) throw new Error(COPY.documentSettings);
    return { ...metadata, body };
}

export function serializeItemDocument(kind, value, id = kind === 'world' ? value.uid : value.id) {
    const fields = ITEM_KINDS[kind];
    const settings = Object.fromEntries(Object.entries(value).filter(([key]) => !['id', 'uid', fields.name, fields.body].includes(key)));
    return joinItemDocument(JSON.stringify({ id, name: String(value[fields.name] || ''), settings }, null, 2), String(value[fields.body] ?? ''));
}

export function itemDocumentValue(kind, content) {
    const { id, name, settings, body } = parseItemDocument(kind, content);
    const fields = ITEM_KINDS[kind];
    return { ...settings, [kind === 'world' ? 'uid' : 'id']: id, [fields.name]: name, [fields.body]: body };
}

export function resolveItemTarget(target, file) {
    if (!ITEM_KINDS[target?.kind]) return target;
    const current = parseItemDocument(target.kind, file.content);
    if (file.originalContent != null && parseItemDocument(target.kind, file.originalContent).id !== current.id) throw new Error(COPY.identity);
    return { ...target, id: current.id };
}

export function itemDocumentPath(directory, name, occupied = new Set(), currentPath = '') {
    // Encoded segments keep slashes, percent signs and dot pairs inside a name.
    const stem = encodeURIComponent(name.trim() || COPY.unnamed).replace(/\.\./g, '%2E%2E');
    const prefix = `${directory}${stem}`;
    let path = `${prefix}.md`, suffix = 2;
    while (occupied.has(path) && path !== currentPath) path = `${prefix}${encodeURIComponent(`（${suffix++}）`)}.md`;
    return path;
}
