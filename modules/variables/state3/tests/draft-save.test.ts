import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// C2: the exact desired draft may already be saved elsewhere; a genuinely
// different edit must remain untouched (unnecessary rejection / lost author work).
test('C2: identical concurrent draft saves succeed, divergent edits remain protected', async () => {
    const path = 'local/cards/fixture.png/variables/definition.json';
    let content = 'same final content', writes = 0;
    const source = ts.transpileModule(readFileSync(new URL('../definition/authoring.ts', import.meta.url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
    const { saveDraft } = runInNewContext(source + '\n({saveDraft})', {
        currentCard: () => ({ avatar: 'fixture.png' }),
        workspaceRepository: { readWorkspace: async () => ({ localSources: [] }), commitWorkspaceMutation: async () => { writes++; return { committed: true }; } },
        readFiles: async () => [{ path, content }], runCardFiles: async () => ({ root: 'local/cards/fixture.png/' }),
        buildWorkspacePreconditions: () => [], INTERNAL_WORKSPACE_TOOL_NAMES: { BATCH_WRITE_FILES: 'BatchWriteFiles' },
        reject: (code: string) => { throw new Error(code); },
    });
    const draft = { root: 'local/cards/fixture.png/', avatar: 'fixture.png', files: [{ path, content: 'before' }] }, updates = [{ path, content }];
    await saveDraft(draft, updates); assert.equal(writes, 1);
    content = 'someone else edited this';
    await assert.rejects(saveDraft(draft, updates), { message: 'draft-conflict' }); assert.equal(writes, 1);
});
