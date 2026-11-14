import { locateFile } from './files.js';
import { ITEM_KINDS, splitItemDocument, joinItemDocument } from './item-document.js';

export function itemEditorProjection(file, mode) {
    const target = locateFile(file.path);
    if (!ITEM_KINDS[target?.kind] || mode === 'source') return null;
    const parts = splitItemDocument(file.content);
    const settings = mode === 'settings';
    const document = joinItemDocument(parts.header, parts.body);
    const offset = settings ? 4 : document.length - parts.body.length;
    return {
        value: settings ? parts.header : parts.body,
        language: settings ? '.json' : ITEM_KINDS[target.kind].language,
        update: value => joinItemDocument(settings ? value : parts.header, settings ? parts.body : value),
        selection: selection => ({ ...selection,
            value: joinItemDocument(settings ? selection.value : parts.header, settings ? parts.body : selection.value),
            selectionStart: offset + selection.selectionStart, selectionEnd: offset + selection.selectionEnd,
            lineStart: document.slice(0, offset).split('\n').length - 1 + selection.lineStart,
            lineEnd: document.slice(0, offset).split('\n').length - 1 + selection.lineEnd }),
    };
}
