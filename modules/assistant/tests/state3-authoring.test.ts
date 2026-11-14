import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { state3JsApiNamespace, withExtensionJsApiManifest } from '../../variables/state3/skill/public-api.js';
import { analyzeJavaScriptApiRequest as analyzeRequest, runJavaScriptApi as runRequest } from '../runtime-src/jsapi-runtime.js';
import { CARD_SKILL } from '../../card-workspace/assistant-contract.js';
import { STATE3_SKILL, cardWorkspaceRequest } from '../../variables/state3/skill/contract.js';
import { STATE2_SKILL } from '../../variables/state2/skill/contract.js';
import { equipmentExample } from '../../variables/state3/definition/example.js';
import { projectVariableFiles } from '../../variables/state3/definition/card-files.js';
import { compileDefinition } from '../../variables/state3/definition/compile.js';
import { settle } from '../../variables/state3/engine/settle.js';
import { runFunctionInVm } from '../../variables/state3/engine/functions.js';
import { getAt } from '../../variables/state3/engine/data.js';
import { accepted, fixture } from '../../variables/state3/tests/fixture.js';
import type { Bundle, Json } from '../../variables/state3/types.js';
import type { checkDraft as DraftChecker } from '../../variables/state3/definition/authoring.js';

interface JsRequest { code: string; purpose?: string; expectedOutput?: string; apiPaths?: string[]; manifest: ReturnType<typeof withExtensionJsApiManifest>; st?: object }
const analyze = analyzeRequest as unknown as (input: JsRequest) => { requestKind: string };
const run = runRequest as unknown as (input: JsRequest) => Promise<{ ok: boolean; requestKind: string; output: unknown; execution: { errorCode: string } }>;

async function loadDraftChecker(): Promise<typeof DraftChecker> {
    const authoring = fileURLToPath(new URL('../../variables/state3/definition/authoring.ts', import.meta.url));
    const pure = new Set(['./digest.js', './format.js', './card-files.js', './compile.js', '../engine/settle.js', '../engine/diagnostics.js']);
    const output = await build({
        stdin: { contents: 'export {checkDraft} from ' + JSON.stringify(authoring) + ';', resolveDir: path.dirname(authoring) },
        bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
        plugins: [{ name: 'draft-host-boundary', setup(builder) {
            builder.onResolve({ filter: /.*/ }, args => {
                if (args.importer !== authoring) {return undefined;}
                return pure.has(args.path)
                    ? { path: pathToFileURL(path.resolve(path.dirname(authoring), args.path.replace(/\.js$/, '.ts'))).href, external: true }
                    : { path: args.path, namespace: 'host-stub' };
            });
            builder.onLoad({ filter: /.*/, namespace: 'host-stub' }, () => ({ contents:
                'export const runCardFiles=undefined,currentCard=undefined,readCharacter=undefined,replaceVariableBundle=undefined,readFiles=undefined,workspaceRepository=undefined,upsertLocalSourceFile=undefined,removeLocalSourcePath=undefined,buildWorkspacePreconditions=undefined,INTERNAL_WORKSPACE_TOOL_NAMES=undefined;' }));
        } }],
    });
    // eslint-disable-next-line no-unsanitized/method -- Execute compiled local production code, never model input.
    return (await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))).checkDraft;
}

test('V3 assistant surface preserves read/effect classification and excludes private methods', async () => {
    let writes = 0;
    const api = state3JsApiNamespace({ inspect: () => ({ ok: true }), apply: () => { writes++; return { ok: true }; }, secret: () => 'private' });
    assert.equal(api.secret, undefined);
    const manifest = withExtensionJsApiManifest({ allowedPaths: ['ctx.chat'], callablePaths: [], apiSemantics: {}, namespaces: {} });
    for (const name of ['inspect', 'preview', 'previewRequest', 'tryDefinition', 'checkDraft', 'settings']) {
        assert.equal(analyze({ code: 'return await st.state3.' + name + '();', manifest }).requestKind, 'read');
    }
    for (const name of ['apply', 'undo', 'enable', 'importRules', 'openDraft', 'saveCardDraft']) {
        assert.equal(analyze({ code: 'return await st.state3.' + name + '();', apiPaths: ['st.state3.' + name], manifest }).requestKind, 'effect');
    }
    const result = await run({ code: 'return await st.state3.apply([]);', purpose: 'Commit', expectedOutput: 'Result', apiPaths: ['st.state3.apply'], manifest, st: { state3: api } });
    assert.equal(result.ok, true); assert.equal(writes, 1);
    const denied = await run({ code: 'return st.state3.secret();', purpose: 'Inspect', expectedOutput: 'Unavailable', manifest, st: { state3: api } });
    assert.equal(denied.ok, false); assert.equal(denied.execution.errorCode, 'jsapi_execution_failed');
});

test('V3 authoring uses its definition while V2 keeps its task routing', () => {
    const root = 'local/card-files/example/', card = { root, name: 'Example', files: ['card.json', 'tasks/init.md', 'variables/definition.json'].map(path => ({ path: root + path })) };
    assert.equal(cardWorkspaceRequest(card, { variables: true, version: '3.0' }).skillId, STATE3_SKILL.id);
    assert.equal(cardWorkspaceRequest(card, { variables: true, version: '2.0' }).skillId, STATE2_SKILL.id);
    assert.equal(cardWorkspaceRequest(card, { variables: false }).skillId, CARD_SKILL.id);
    assert.equal(cardWorkspaceRequest(card, { variables: true, version: '2.0' }).selectedFilePath, root + 'tasks/init.md');
});

test('documented authoring examples execute the production checker and leave chat state unchanged', async () => {
    const checkDraft = await loadDraftChecker(), host = fixture(), bundle = equipmentExample(), root = 'local/card-files/example/';
    const draft = { root, avatar: 'example.png', name: 'Example', files: projectVariableFiles(root, bundle) };
    const unfinished = { ...draft, files: [{ path: root + 'variables/definition.json', content: '{"name":"draft"}' }] };
    const originalDraft = structuredClone(unfinished);
    const invalid = await checkDraft(unfinished, []);
    assert.equal(invalid.ok, false); assert.ok(invalid.diagnostics[0].errors);
    assert.deepEqual(unfinished, originalDraft);
    accepted(await host.service.enable(bundle)); const before = host.saved();
    const namespace = state3JsApiNamespace({
        openDraft: async () => structuredClone(draft), checkDraft, inspect: () => host.service.inspect(),
        tryDefinition: (candidate: Bundle, input: unknown, options: { state: Json }) => settle(compileDefinition(candidate), options.state, input),
        preview: host.service.preview,
    });
    const markdown = await readFile(new URL('../../variables/state3/skill/SKILL.md', import.meta.url), 'utf8');
    for (const [, language, code] of markdown.matchAll(/\x60\x60\x60(js|javascript)\n([\s\S]*?)\x60\x60\x60/g)) {
        if (language === 'javascript') {
            const state = accepted(await host.service.inspect()).state, input = [7];
            assert.equal(await runFunctionInVm({ id: 'health_bonus', source: code, input, state, reads: [['hero', 'baseHealth']] }), Number(getAt(state, ['hero', 'baseHealth'])) + input[0]);
        } else {
            const result = await run({ code, purpose: 'Trial documented example', expectedOutput: 'Settlement',
                apiPaths: ['st.state3.openDraft', 'st.state3.checkDraft', 'st.state3.inspect', 'st.state3.tryDefinition', 'st.state3.preview'],
                manifest: withExtensionJsApiManifest(), st: { state3: namespace } });
            assert.equal(result.ok, true, JSON.stringify(result.execution));
            assert.equal((result.output as { ok: boolean }).ok, true);
        }
    }
    assert.deepEqual(host.saved(), before);
});
