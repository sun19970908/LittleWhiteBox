import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../assistant/shared/session-db.js';
import { workspaceRepository } from '../assistant/shared/workspace-repository.js';
import { buildWorkspacePreconditions } from '../assistant/shared/workspace-preconditions.js';
import { upsertLocalSourceFile, removeLocalSourcePath } from '../assistant/shared/local-workspace-kernel.js';
import { readFiles, storeFiles, storeItemReceipt } from './workspace.js';
import { cardFiles, locateFile, projectItem } from './files.js';
import { resolveItemTarget, itemDocumentValue, serializeItemDocument, itemDocumentPath } from './item-document.js';

test('writeback receipt preserves newer editor text and unrelated files across reload', async () => {
    await db.delete();
    await db.open();
    await storeFiles([{ path: 'local/cards/a.png/description.md', content: 'saved' }, { path: 'local/notes.md', content: 'keep' }]);
    const path = 'local/cards/a.png/description.md', args = { path, content: 'typed while saving' };
    const { localSources } = await workspaceRepository.readWorkspace();
    await workspaceRepository.commitWorkspaceMutation({ name: 'Write', args,
        preconditions: buildWorkspacePreconditions('Write', args, localSources),
        execute: async sources => ({ result: { ok: true }, nextSources: upsertLocalSourceFile(sources, path, args.content).nextSources }) });
    await storeFiles([{ path, content: 'submitted' }], { baselineOnly: true });
    db.close();
    await db.open();
    const files = await readFiles(), current = files.find(file => file.path === path);
    assert.equal(current.content, 'typed while saving');
    assert.equal(current.originalContent, 'submitted');
    assert.equal(files.find(file => file.path === 'local/notes.md').content, 'keep');
    await db.delete();
});

// Acceptance: a rename receipt cannot overwrite a same-name item, a newer
// partial edit or a deletion; reload retains the outcome (lost work).
test('named writeback receipt renames safely and retains concurrent edits and deletion', async () => {
    await db.delete(); await db.open();
    try {
        const directory = 'local/cards/a.png/tasks/';
        const one = { path: itemDocumentPath(directory, 'one'), content: serializeItemDocument('tasks', { id: 'one', name: 'one', commands: 'old' }) };
        const two = { path: itemDocumentPath(directory, 'two'), content: serializeItemDocument('tasks', { id: 'two', name: 'two', commands: 'keep' }) };
        await storeFiles([one, two]);
        const renamed = serializeItemDocument('tasks', { id: 'one', name: 'two', commands: 'new' });
        const receipt = await storeItemReceipt(one, renamed, 'tasks');
        assert.notEqual(receipt.path, two.path);
        assert.equal((await readFiles()).find(file => file.path === two.path).content, two.content);
        const submitted = (await readFiles()).find(file => file.path === receipt.path);
        const mutate = async (name, args, execute) => workspaceRepository.commitWorkspaceMutation({ name, args,
            preconditions: buildWorkspacePreconditions(name, args, (await workspaceRepository.readWorkspace()).localSources), execute });
        const partial = '---\n{ unfinished\n---\nmy draft';
        await mutate('Write', { path: submitted.path, content: partial }, async sources => ({ result: { ok: true }, nextSources: upsertLocalSourceFile(sources, submitted.path, partial).nextSources }));
        const later = await storeItemReceipt(submitted, renamed, 'tasks');
        assert.equal(later.hasUnsavedEdits, true);
        db.close(); await db.open();
        assert.equal((await readFiles()).find(file => file.path === submitted.path).content, partial);
        await mutate('Delete', { path: submitted.path }, async sources => ({ result: { ok: true }, nextSources: removeLocalSourcePath(sources, submitted.path).nextSources }));
        await storeItemReceipt(submitted, renamed, 'tasks');
        assert.equal((await readFiles()).some(file => file.path === submitted.path), false);
    } finally { await db.delete(); }
});

test('whole task and regex documents keep settings, body and identity without exporting other extensions', () => {
    const task = { id: 'task-1', name: 'init', commands: 'half a script(', triggerTiming: 'chat_changed', x: { variableCard: { v: 1, requirements: 'keep' }, other: 42 } };
    const regex = { id: 'regex-1', scriptName: 'keep', replaceString: '<div>hello</div>', placement: [2], disabled: true };
    const files = cardFiles('卡.png', { extensions: { 'xiaobaix-tasks': { tasks: [task] }, regex_scripts: [regex], tavern_helper: { scripts: ['unowned'] } } }, []);
    for (const value of [task, regex]) {
        const body = files.find(file => file.path.includes(encodeURIComponent(value.name || value.scriptName)) && file.path.endsWith('.md'));
        const target = resolveItemTarget(locateFile(body.path), body);
        assert.equal(target.avatar, '卡.png');
        assert.equal(target.id, value.id);
        assert.equal(body.content, projectItem(target, value));
        assert.deepEqual(itemDocumentValue(target.kind, body.content), value);
    }
    assert.ok(files.every(file => !file.content.includes('unowned')));
});
