// File layout and projections are shared by the tool, host and workspace UI.
export const CARD_ROOT = 'local/cards/';
export const CARD_FILE = 'card.json';
export const TEXT_FIELDS = ['description', 'personality', 'scenario', 'mes_example', 'system_prompt', 'post_history_instructions', 'creator_notes'];
export const CARD_FIELDS = ['name', 'tags', 'creator', 'character_version'];
export const json = value => JSON.stringify(value, null, 2);
export const rootFor = avatar => `${CARD_ROOT}${encodeURIComponent(avatar)}/`;
export const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

export function locateFile(path) {
    if (!path.startsWith(CARD_ROOT)) return null;
    const parts = path.slice(CARD_ROOT.length).split('/');
    if (parts.length < 2) return null;
    const avatar = decodeURIComponent(parts.shift());
    const relative = parts.join('/');
    const base = { avatar, root: rootFor(avatar), relative };
    if (relative === CARD_FILE) return { ...base, kind: 'card' };
    const field = TEXT_FIELDS.find(key => relative === `${key}.md`);
    if (field) return { ...base, kind: 'field', field };
    let match = relative.match(/^message\/(0|[1-9]\d*)\.md$/);
    if (match) return { ...base, kind: 'greeting', index: Number(match[1]) };
    match = relative.match(/^world_book\/([^/]+)\/(0|[1-9]\d*)\.(json|md)$/);
    if (match) return { ...base, kind: 'world', book: decodeURIComponent(match[1]), id: Number(match[2]), settings: match[3] === 'json' };
    match = relative.match(/^(regex|tasks)\/([^/]+)\.(json|html|js)$/);
    if (match && (match[3] === 'json' || match[3] === (match[1] === 'regex' ? 'html' : 'js'))) {
        return { ...base, kind: match[1], id: decodeURIComponent(match[2]), settings: match[3] === 'json' };
    }
    return null;
}

export function projectCard(data) {
    return { ...Object.fromEntries(CARD_FIELDS.map(key => [key, data[key] ?? (key === 'tags' ? [] : '')])), world: data.extensions?.world || '' };
}

export function projectItem(target, value) {
    if (value == null) return null;
    const textKey = target.kind === 'world' ? 'content' : target.kind === 'regex' ? 'replaceString' : 'commands';
    return target.settings ? json(without(value, [textKey, 'id', 'uid'])) : String(value[textKey] ?? '');
}

export function cardFiles(avatar, data, books) {
    const root = rootFor(avatar);
    const files = [{ path: root + CARD_FILE, content: json(projectCard(data)) }];
    for (const field of TEXT_FIELDS) files.push({ path: `${root}${field}.md`, content: String(data[field] || '') });
    [data.first_mes || '', ...(data.alternate_greetings || [])].forEach((content, index) => files.push({ path: `${root}message/${index}.md`, content }));
    const addItem = (kind, prefix, id, item, extension) => {
        files.push({ path: `${root}${prefix}/${encodeURIComponent(id)}.json`, content: projectItem({ kind, settings: true }, item) });
        files.push({ path: `${root}${prefix}/${encodeURIComponent(id)}.${extension}`, content: projectItem({ kind, settings: false }, item) });
    };
    for (const [name, book] of books) for (const [id, entry] of Object.entries(book.entries || {})) addItem('world', `world_book/${encodeURIComponent(name)}`, id, entry, 'md');
    for (const item of data.extensions?.regex_scripts || []) addItem('regex', 'regex', item.id, item, 'html');
    for (const item of data.extensions?.['xiaobaix-tasks']?.tasks || []) addItem('tasks', 'tasks', item.id, item, 'js');
    return files;
}
