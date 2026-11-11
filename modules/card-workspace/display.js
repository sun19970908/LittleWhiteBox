import { locateFile } from './files.js';

const ITEM_DISPLAY = {
    tasks: { nameField: 'name', settings: '任务设置', body: '执行脚本' },
    regex: { nameField: 'scriptName', settings: '正则设置', body: '替换内容' },
    world: { nameField: 'comment', settings: '条目设置', body: '正文' },
};

function locateDisplayFile(path) {
    try {
        return locateFile(path);
    } catch (error) {
        // Manually authored workspace filenames need not follow the card format.
        if (!(error instanceof URIError)) throw error;
        return null;
    }
}

export function cardItemGroupKey(path) {
    const target = locateDisplayFile(path);
    return ITEM_DISPLAY[target?.kind] ? `item:${path.replace(/\.[^.]+$/, '')}` : '';
}

function readDisplayName(file, field) {
    // While JSON is being edited it can be incomplete; keep the last saved name.
    for (const content of [file?.content, file?.originalContent]) {
        if (!content) continue;
        try {
            const value = JSON.parse(content)?.[field];
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
    const byPath = new Map(files.map(file => [file.path, file]));
    const descriptions = new Map();
    for (const file of files) {
        const target = locateDisplayFile(file.path);
        const display = ITEM_DISPLAY[target?.kind];
        if (!display) continue;
        const settingsPath = file.path.replace(/\.[^.]+$/, '.json');
        const name = readDisplayName(byPath.get(settingsPath), display.nameField) || String(target.id);
        const label = target.settings ? display.settings : display.body;
        descriptions.set(file.path, {
            groupKey: cardItemGroupKey(file.path),
            name,
            label,
            title: `${name} / ${label}`,
        });
    }
    return descriptions;
}
