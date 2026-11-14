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
import { variableCardHost, onRulesSaved } from '../definition/card-host.js';
import { equipmentExample } from '../definition/example.js';
import { digest } from '../definition/digest.js';
import { compileDefinition } from '../definition/compile.js';

const readFiles = async (): Promise<CardFile[]> => await rawFiles() as CardFile[];
const storeFiles = writeFiles as (files: CardFile[], options?: { baselineOnly?: boolean; observed?: Awaited<ReturnType<typeof observeTree>>; scopeRoot?: string; removePaths?: string[] }) => Promise<unknown>;
const root = 'local/cards/isolated.png/';
const original = { definition: { name: 'unfinished', functions: { old: { reads: [] } } }, functions: { old: 'unfinished(' } };

// A4: invalid packages, including unknown access keys, cannot be saved or imported;
// failed saves preserve the card, while corrected drafts round-trip (silent rule loss).
test('A4: actual save boundary rejects unknown access keys, including unchanged cards, and accepts the boolean format', async () => {
    const valid = equipmentExample();
    let card = { avatar: 'isolated.png', name: 'isolated', data: { extensions: { [CARD_EXTENSION]: JSON.stringify(valid), other: { keep: true } } } };
    let writes = 0;
    const host = variableCardHost({
        readCharacter: async () => structuredClone(card), assertCard() {},
        async request(_url, body) {
            writes++;
            card.data.extensions[CARD_EXTENSION] = (body as ReturnType<typeof variableExtensionWrite>).data.extensions[CARD_EXTENSION];
        },
        publishCharacter(saved) {card = saved as typeof card;}, unconfirmed: 'not saved',
    });
    const save = (draft: unknown) => {
        const files = projectVariableFiles(root, draft);
        files[0].originalGroupHash = digest(JSON.parse(card.data.extensions[CARD_EXTENSION]));
        return host.save({ avatar: card.avatar, root }, files[0], undefined, files.slice(1).map(file => ({ file })));
    };
    const unknown = structuredClone(valid);
    (unknown.definition.access[0] as unknown as Record<string, unknown>).write = ['unequip'];
    assert.throws(() => compileDefinition(unknown), { code: 'definition-schema' });
    for (const stored of [valid, unknown]) {
        card.data.extensions[CARD_EXTENSION] = JSON.stringify(stored);
        const before = structuredClone(card);
        await assert.rejects(save(unknown));
        await assert.rejects(host.replace(card.avatar, unknown, digest(card.data.extensions[CARD_EXTENSION])), { code: 'definition-schema' });
        assert.deepEqual(card, before); assert.equal(writes, 0);
    }
    const invalid = structuredClone(valid); invalid.functions.undeclared = '() => 1';
    await assert.rejects(save(invalid)); assert.equal(writes, 0);
    const saved = await save(valid);
    assert.equal(saved.unchanged, false); assert.equal(writes, 1);
    assert.deepEqual(JSON.parse(card.data.extensions[CARD_EXTENSION]), valid);
    assert.deepEqual(card.data.extensions.other, { keep: true });
    assert.deepEqual(variableBundleFromFiles(root, await host.read({ avatar: card.avatar, root })), valid);
    assert.equal((await save(valid)).unchanged, true); assert.equal(writes, 1);
});

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

test('K15: verified full-package replacement removes functions, preserves other card data and rejects stale/invalid imports', async () => {
    const previous = equipmentExample(), next = equipmentExample();
    previous.definition.functions.old = { reads: [], description: 'old function' }; previous.functions.old = '() => 1';
    let card = { avatar: 'isolated.png', name: 'isolated', data: { extensions: { [CARD_EXTENSION]: JSON.stringify(previous), other: { keep: true } }, description: 'keep prose' } };
    let writes = 0, published = 0, refreshed = 0;
    const stop = onRulesSaved(async () => { refreshed++; });
    const host = variableCardHost({
        readCharacter: async () => structuredClone(card), assertCard(avatar) { assert.equal(avatar, card.avatar); },
        async request(_url, input) {
            const update = input as ReturnType<typeof variableExtensionWrite>;
            writes++;
            assert.deepEqual(Object.keys(update.data.extensions), [CARD_EXTENSION]);
            card.data.extensions[CARD_EXTENSION] = update.data.extensions[CARD_EXTENSION];
        },
        publishCharacter(saved) { published++; card = saved as typeof card; }, unconfirmed: 'not saved',
    });
    const baseline = digest(card.data.extensions[CARD_EXTENSION]);
    const invalid = structuredClone(next); invalid.functions.extra = '() => 2';
    await assert.rejects(host.replace(card.avatar, invalid, baseline));
    assert.equal(writes, 0);
    await host.replace(card.avatar, next, baseline);
    assert.deepEqual(JSON.parse(card.data.extensions[CARD_EXTENSION]), next);
    assert.deepEqual(card.data.extensions.other, { keep: true });
    assert.equal(card.data.description, 'keep prose');
    assert.equal(published, 1);
    assert.equal(refreshed, 1);
    stop();
    await assert.rejects(host.replace(card.avatar, previous, baseline), { code: 'rules-conflict' });
    assert.equal(writes, 1);
});
