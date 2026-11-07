import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../assistant/shared/session-db.js';
import { workspaceRepository } from '../assistant/shared/workspace-repository.js';
import { buildWorkspacePreconditions } from '../assistant/shared/workspace-preconditions.js';
import { upsertLocalSourceFile } from '../assistant/shared/local-workspace-kernel.js';
import { readFiles, storeFiles } from './workspace.js';
import { cardFiles, locateFile, projectItem } from './files.js';

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

test('split task and regex files keep settings, body and identity without exporting other extensions', () => {
    const task = { id: 'task-1', name: 'init', commands: 'half a script(', triggerTiming: 'chat_changed', x: { variableCard: { v: 1, requirements: 'keep' }, other: 42 } };
    const regex = { id: 'regex-1', scriptName: 'keep', replaceString: '<div>hello</div>', placement: [2], disabled: true };
    const files = cardFiles('卡.png', { extensions: { 'xiaobaix-tasks': { tasks: [task] }, regex_scripts: [regex], tavern_helper: { scripts: ['unowned'] } } }, []);
    for (const value of [task, regex]) {
        const body = files.find(file => file.path.includes(encodeURIComponent(value.id)) && !file.path.endsWith('.json'));
        const settings = files.find(file => file.path.includes(encodeURIComponent(value.id)) && file.path.endsWith('.json'));
        const target = locateFile(body.path);
        assert.equal(target.avatar, '卡.png');
        assert.equal(target.id, value.id);
        assert.equal(body.content, projectItem(target, value));
        assert.deepEqual({ ...JSON.parse(settings.content), id: target.id, [target.kind === 'tasks' ? 'commands' : 'replaceString']: body.content }, value);
    }
    assert.ok(files.every(file => !file.content.includes('unowned')));
});
