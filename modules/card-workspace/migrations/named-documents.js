import { normalizeLocalSources, flattenLocalSourceFiles, removeLocalSourceFile, upsertLocalSourceFile } from '../../assistant/shared/local-workspace-kernel.js';
import { itemDocumentPath, serializeItemDocument, joinItemDocument, ITEM_KINDS } from '../item-document.js';

// Frozen split-file layout from workspace DB v3. This runs once at upgrade;
// current file tools and writeback only understand named item documents.
export function migrateNamedDocuments(workspace) {
    let sources = normalizeLocalSources(workspace.localSources);
    const files = flattenLocalSourceFiles(sources), pairs = new Map();
    for (const file of files) {
        const match = file.path.match(/^(local\/cards\/[^/]+\/)(world_book\/[^/]+\/(\d+)\.(json|md)|(regex|tasks)\/([^/]+)\.(json|html|js))$/);
        if (!match) continue;
        const kind = match[5] || 'world', extension = match[4] || match[7];
        if (extension !== 'json' && extension !== (kind === 'world' ? 'md' : kind === 'regex' ? 'html' : 'js')) continue;
        const key = file.path.replace(/\.[^.]+$/, '');
        if (!pairs.has(key)) pairs.set(key, { kind, id: kind === 'world' ? Number(match[3]) : decodeURIComponent(match[6]), directory: file.path.slice(0, file.path.lastIndexOf('/') + 1) });
        pairs.get(key)[extension === 'json' ? 'settings' : 'body'] = file;
    }
    const occupied = new Set(files.map(file => file.path)), renamed = new Map();
    for (const pair of pairs.values()) {
        const { kind, id, settings, body, directory } = pair;
        const fields = ITEM_KINDS[kind];
        const convert = original => {
            const text = original ? settings?.originalContent : settings?.content;
            const content = (original ? body?.originalContent : body?.content) ?? '';
            if (original && (settings?.originalContent == null || body?.originalContent == null)) return null;
            try {
                const value = JSON.parse(text || '{}');
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError();
                return serializeItemDocument(kind, { ...value, [fields.body]: content }, id);
            } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
                // Preserve an unfinished settings edit verbatim inside the header.
                // It remains editable and cannot be published until repaired.
                return joinItemDocument(`{\n  "id": ${JSON.stringify(id)},\n  "name": "",\n  "settings": ${text}\n}`, content);
            }
        };
        const content = convert(false), originalContent = convert(true);
        let name = '';
        for (const text of [settings?.content, settings?.originalContent]) {
            try { name = JSON.parse(text || '{}')?.[fields.name] || ''; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
            if (name) break;
        }
        for (const file of [settings, body].filter(Boolean)) occupied.delete(file.path);
        const path = itemDocumentPath(directory, String(name), occupied);
        occupied.add(path);
        for (const file of [settings, body].filter(Boolean)) {
            sources = removeLocalSourceFile(sources, file.path).nextSources;
            renamed.set(file.path, path);
        }
        sources = upsertLocalSourceFile(sources, path, content, { originalContent }).nextSources;
    }
    return { ...workspace, localSources: sources,
        selectedFilePath: renamed.get(workspace.selectedFilePath) || workspace.selectedFilePath,
        selectedTreePath: renamed.get(workspace.selectedTreePath) || workspace.selectedTreePath };
}

export async function migrateCardDocuments(transaction) {
    await transaction.table('workspace').toCollection().modify(workspace => Object.assign(workspace, migrateNamedDocuments(workspace)));
}
