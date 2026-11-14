import { locateFile } from './files.js';
import { ITEM_KINDS, itemDocumentPath, splitItemDocument } from './item-document.js';
import { displayCardWorkspaceName } from './paths.js';

function locateDisplayFile(path) {
    try {
        return locateFile(path);
    } catch (error) {
        // Manually authored workspace filenames need not follow the card format.
        if (!(error instanceof URIError)) throw error;
        return null;
    }
}

function readDisplayName(file) {
    // While JSON is being edited it can be incomplete; keep the last saved name.
    for (const content of [file?.content, file?.originalContent]) {
        if (!content) continue;
        try {
            const value = JSON.parse(splitItemDocument(content).header)?.name;
            return typeof value === 'string' ? value.trim() : '';
        } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
        }
    }
    return '';
}

// Labels are derived from the same editable files as writeback, never persisted
// as aliases. Identically named entries still have distinct IDs and paths.
export function describeCardWorkspaceFiles(files) {
    const descriptions = new Map();
    const labels = new Set();
    // Give the unsuffixed path first choice; the same labels serve tree and editor.
    for (const file of [...files].sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))) {
        const target = locateDisplayFile(file.path);
        if (!target) continue;
        const name = (ITEM_KINDS[target.kind] ? readDisplayName(file) : '') || displayCardWorkspaceName(file.path, file.name);
        const labelPath = itemDocumentPath(file.path.slice(0, file.path.lastIndexOf('/') + 1), name, labels);
        labels.add(labelPath);
        const label = decodeURIComponent(labelPath.split('/').at(-1).slice(0, -3));
        descriptions.set(file.path, {
            name, label, title: label, kind: target.kind,
            ...(target.book ? { book: target.book } : {}),
        });
    }
    return descriptions;
}

export function cardFileDirectory(files) {
    const descriptions = describeCardWorkspaceFiles(files);
    return files.map(file => {
        const description = descriptions.get(file.path);
        return { path: file.path, name: description?.name || file.path.split('/').at(-1), kind: description?.kind || 'file',
            ...(description?.book ? { book: description.book } : {}) };
    });
}
