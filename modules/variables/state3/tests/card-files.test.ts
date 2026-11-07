import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../../../assistant/shared/session-db.js';
import { workspaceRepository } from '../../../assistant/shared/workspace-repository.js';
import { buildWorkspacePreconditions } from '../../../assistant/shared/workspace-preconditions.js';
import { upsertLocalSourceFile, removeLocalSourcePath } from '../../../assistant/shared/local-workspace-kernel.js';
import { storeFiles as writeFiles, readFiles as rawFiles, observeTree } from '../../../card-workspace/workspace.js';
import { cardFiles, locateFile } from '../../../card-workspace/files.js';
import { CARD_EXTENSION, DEFINITION_FILE, FUNCTION_DIRECTORY } from '../definition/format.js';
import { projectVariableFiles, variableBundleFromFiles, prepareVariableWrite, variableExtensionWrite, type CardFile } from '../definition/card-files.js';
import { digest } from '../definition/digest.js';

const readFiles = async (): Promise<CardFile[]> => await rawFiles() as CardFile[];
const storeFiles = writeFiles as (files: CardFile[], options?: { baselineOnly?: boolean; observed?: Awaited<ReturnType<typeof observeTree>>; scopeRoot?: string; removePaths?: string[] }) => Promise<unknown>;
const root = 'local/cards/isolated.png/';
const original = { definition: { name: 'unfinished', functions: { old: { reads: [] } } }, functions: { old: 'unfinished(' } };

async function edit(path: string, content: string) {
    const args = { path, content }, { localSources } = await workspaceRepository.readWorkspace();
    await workspaceRepository.commitWorkspaceMutation({ name: 'Write', args, signal: undefined, retryContent: undefined,
        preconditions: buildWorkspacePreconditions('Write', args, localSources),
        execute: async (sources: Parameters<typeof upsertLocalSourceFile>[0]) => ({ result: { ok: true }, nextSources: upsertLocalSourceFile(sources, path, content).nextSources }) });
}
async function remove(path: string) {
    const args = { path }, { localSources } = await workspaceRepository.readWorkspace();
    await workspaceRepository.commitWorkspaceMutation({ name: 'Delete', args, signal: undefined, retryContent: undefined,
        preconditions: buildWorkspacePreconditions('Delete', args, localSources),
        execute: async (sources: Parameters<typeof upsertLocalSourceFile>[0]) => ({ result: { ok: true }, nextSources: removeLocalSourcePath(sources, path).nextSources }) });
}

test('whole rule-package projection preserves unfinished authoring and unrelated extensions', () => {
    const data = { name: 'isolated', extensions: { other: { keep: true }, [CARD_EXTENSION]: original } };
    const files = cardFiles('isolated.png', data, []);
    assert.deepEqual(variableBundleFromFiles(root, files), original);
    assert.equal((locateFile(root + FUNCTION_DIRECTORY + 'old.js') as { name: string }).name, 'old');
    assert.equal(locateFile(root + 'variables/functions/nested/old.js'), null);
    assert.equal(locateFile(root + 'variables/functions/../old.js'), null);
    const next = { definition: { name: 'still unfinished' }, functions: {} };
    const request = variableExtensionWrite({ avatar: 'isolated.png', name: 'isolated' }, next);
    assert.deepEqual(Object.keys(request.data.extensions), [CARD_EXTENSION]);
    assert.deepEqual(JSON.parse(request.data.extensions[CARD_EXTENSION]), next);
    assert.deepEqual(data.extensions[CARD_EXTENSION], original);
});

test('deleted functions retain whole-package conflict baseline across edit, save receipt and reload', async () => {
    await db.delete(); await db.open();
    try {
        await storeFiles(projectVariableFiles(root, original));
        await remove(root + FUNCTION_DIRECTORY + 'old.js');
        await edit(root + DEFINITION_FILE, JSON.stringify({ name: 'draft without old function' }));
        let files = await readFiles();
        const prepared = prepareVariableWrite(root, files, original);
        assert.deepEqual(prepared.bundle.functions, {});
        assert.throws(() => prepareVariableWrite(root, files, { ...original, functions: { old: 'changed externally' } }));
        assert.throws(() => prepareVariableWrite(root, files, null));
        await edit(root + DEFINITION_FILE, JSON.stringify({ name: 'typed during save' }));
        await storeFiles(projectVariableFiles(root, prepared.bundle), { baselineOnly: true });
        (db as unknown as { close(): void }).close(); await db.open();
        files = await readFiles();
        assert.equal(variableBundleFromFiles(root, files).definition.name, 'typed during save');
        assert.equal(files.find(file => file.path === root + DEFINITION_FILE)!.originalGroupHash, digest(prepared.bundle));
        assert.equal(prepareVariableWrite(root, files, prepared.bundle).bundle.definition.name, 'typed during save');
        assert.throws(() => prepareVariableWrite(root, files, original));
        assert.equal(prepareVariableWrite(root, files, variableBundleFromFiles(root, files)).unchanged, true);
    } finally { await db.delete(); }
});

test('whole-package refresh cannot overwrite a concurrently created function and removes confirmed remote deletions', async () => {
    await db.delete(); await db.open();
    try {
        await storeFiles(projectVariableFiles(root, original));
        const scopeRoot = root + 'variables/', observed = await observeTree(scopeRoot);
        await edit(root + FUNCTION_DIRECTORY + 'new.js', 'return 1');
        const next = { definition: { name: 'new package' }, functions: {} };
        await assert.rejects(storeFiles(projectVariableFiles(root, next), { observed, scopeRoot,
            removePaths: [root + FUNCTION_DIRECTORY + 'old.js'] }));
        assert.equal(variableBundleFromFiles(root, await readFiles()).functions.old, original.functions.old);
        assert.equal(variableBundleFromFiles(root, await readFiles()).functions.new, 'return 1');
        const confirmed = await observeTree(scopeRoot);
        await storeFiles(projectVariableFiles(root, next), { observed: confirmed, scopeRoot,
            removePaths: [root + FUNCTION_DIRECTORY + 'old.js', root + FUNCTION_DIRECTORY + 'new.js'] });
        assert.deepEqual(variableBundleFromFiles(root, await readFiles()), next);
    } finally { await db.delete(); }
});
