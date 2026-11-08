import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { rootFor, displayCardWorkspacePath, displayCardWorkspaceName } from '../../card-workspace/paths.js';
import { buildWorkspaceTree, collectDirectoryExpansionKeys } from '../app-src/workspace/local-workspace-tree.js';
import { renderWorkspace } from '../app-src/workspace/local-workspace-ui.js';
import { cardFiles, locateFile } from '../../card-workspace/files.js';

// Acceptance: readable card names must still select/save the original file
// (wrong-target writes / lost work). Literal workspace names stay literal;
// URI decoding occurs once and never turns a name into a new path identity.
const paths = ['作者测试.png', 'Alice Smith.png', 'Alice.png', 'literal%20.png', 'a/b.png']
    .map(name => `${rootFor(name)}system_prompt.md`);
const source = {
    sourceId: 'workspace', label: 'local', rootPath: 'local/',
    directories: [`cards/${encodeURIComponent('空卡.png')}/`],
    files: paths.map(path => ({ path, relativePath: path.slice(6), name: 'system_prompt.md', content: 'draft', originalContent: '' })),
};

// Acceptance: grouping/renaming tasks must never merge same-name tasks or
// redirect a settings/body edit to another task (wrong-target writes).
test('named task groups preserve both files and distinct IDs after rename and filtering', () => {
    const tasks = [
        { id: 'id/a%', name: '日常', commands: '/echo first', interval: 2 },
        { id: 'id-b', name: '日常', commands: '/echo second', interval: 3 },
    ];
    const files = cardFiles('卡.png', { extensions: { 'xiaobaix-tasks': { tasks } } }, [])
        .map(file => ({ ...file, relativePath: file.path.slice(6), name: file.path.split('/').at(-1), originalContent: file.content }));
    const fixture = { sourceId: 'workspace', label: 'local', rootPath: 'local/', files };
    const getGroups = tree => tree.nodes[0].children[0].children.find(node => node.path.endsWith('/tasks/')).children;
    const initial = buildWorkspaceTree([fixture], { searchQuery: '日常' });
    const groups = getGroups(initial);
    assert.equal(groups.length, 2);
    assert.notEqual(groups[0].key, groups[1].key);
    for (const group of groups) {
        const targets = group.children.map(node => locateFile(node.path));
        assert.equal(targets.length, 2);
        assert.equal(targets[0].id, targets[1].id);
        assert.notEqual(targets[0].settings, targets[1].settings);
        assert.ok(group.children.every(node => files.includes(node.file)));
    }
    const settings = files.find(file => locateFile(file.path)?.id === tasks[0].id && locateFile(file.path)?.settings);
    settings.content = JSON.stringify({ ...JSON.parse(settings.content), name: '重命名' });
    const renamed = buildWorkspaceTree([fixture], { searchQuery: '重命名' });
    assert.deepEqual(renamed.visiblePaths.map(path => locateFile(path).id), [tasks[0].id, tasks[0].id]);
    assert.equal(getGroups(renamed)[0].key, groups.find(group => locateFile(group.children[0].path).id === tasks[0].id).key);
    assert.deepEqual(tasks.map(task => task.commands), ['/echo first', '/echo second']);
});

test('card display/search preserves raw keys, paths and files without decoding unrelated names', () => {
    for (const [index, name] of ['作者测试.png', 'Alice Smith.png', 'Alice.png', 'literal%20.png', 'a/b.png'].entries()) {
        const tree = buildWorkspaceTree([source], { searchQuery: name });
        assert.deepEqual(tree.visiblePaths, [paths[index]]);
        const directory = tree.nodes[0].children[0];
        assert.equal(directory.label, name);
        assert.equal(directory.path, rootFor(name));
        assert.equal(directory.children[0].path, paths[index]);
        assert.equal(directory.children[0].key, `file:${paths[index]}`);
        assert.strictEqual(directory.children[0].file, source.files[index]);
        assert.equal(displayCardWorkspacePath(paths[index]), `local/cards/${name}/system_prompt.md`);
    }
    const emptyTree = buildWorkspaceTree([source], { searchQuery: '空卡' });
    assert.equal(emptyTree.nodes[0].children[0].path, rootFor('空卡.png'));
    const bookPath = rootFor('作者测试.png') + `world_book/${encodeURIComponent('规则/说明')}/0.md`;
    assert.equal(displayCardWorkspaceName(bookPath.slice(0, -4), ''), '规则/说明');
    for (const path of ['local/notes/literal%20.md', rootFor('Alice.png') + 'variables/functions/percent%20.ts']) {
        assert.equal(displayCardWorkspacePath(path), path);
    }
    const malformed = 'local/cards/bad%name.png/system_prompt.md';
    assert.equal(displayCardWorkspacePath(malformed), malformed);
});

test('rendered card selections and save actions keep encoded targets', t => {
    const { document } = parseHTML('<html><body><div id="workspace"></div></body></html>');
    const previousDocument = globalThis.document;
    globalThis.document = document;
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    const tree = buildWorkspaceTree([source]);
    const calls = [];
    const container = document.querySelector('#workspace');
    renderWorkspace(container, {
        workspaceTree: tree,
        selectedMatch: { source, file: source.files[0] },
        workspaceState: { selectedFilePath: paths[0], viewerMode: 'original', treeExpandedKeys: [...collectDirectoryExpansionKeys(tree.nodes)] },
        showSaveButton: true, canSaveFile: () => true,
        hasOriginalSnapshot: () => true,
        onSelectNode: path => calls.push(['directory', path]),
        onSelectFile: path => calls.push(['file', path]),
        onSaveFile: path => calls.push(['save', path]),
    });
    const directoryButton = [...container.querySelectorAll('.type-dir.xb-assistant-workspace-tree-button')]
        .find(button => button.textContent.includes('作者测试.png'));
    directoryButton.click();
    const selectedButton = container.querySelector('.is-selected .xb-assistant-workspace-tree-button');
    selectedButton.click();
    container.querySelector('[data-action="save-file"]').click();
    assert.deepEqual(calls, [['directory', rootFor('作者测试.png')], ['file', paths[0]], ['save', paths[0]]]);
    renderWorkspace(container, {
        workspaceTree: tree,
        selectedMatch: { source, file: source.files[1] },
        workspaceState: { selectedFilePath: paths[1], viewerMode: 'original', treeExpandedKeys: [...collectDirectoryExpansionKeys(tree.nodes)] },
        showSaveButton: true, canSaveFile: () => true, hasOriginalSnapshot: () => true,
        onSaveFile: path => calls.push(['save-next', path]),
    });
    container.querySelector('[data-action="save-file"]').click();
    assert.deepEqual(calls.at(-1), ['save-next', paths[1]]);
});
