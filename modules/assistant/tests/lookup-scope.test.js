import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS } from '../app-src/tooling.js';
import { createHostToolRequestController } from '../app-src/runtime/host-tool-requests.js';
import { LOOKUP_SCOPES, INVALID_LOOKUP_SCOPE, normalizeLookupScope, assertLookupScopePath } from '../shared/lookup-scope.js';
import { upsertLocalSourceFile } from '../shared/local-workspace-kernel.js';
import { callReadableWorkspaceTool } from '../shared/workspace-tool-paths.js';
import { storedCardWorkspacePath } from '../../card-workspace/paths.js';
import { loadWorkspaceHostTools } from './helpers/workspace-host.js';

// 验收：非法 scope 返回原值和合法来源，修正后可检索同一卡目录；代价：协议错误、浪费模型调用。
// 验收：schema 和执行器认可相同来源，默认源码及工作区隔离不变；代价：读错资料。
test('lookup failures preserve the submitted scope and all four tools work after correcting it', async () => {
    const execute = await loadWorkspaceHostTools();
    const directory = 'local/cards/回西厢1.png/world_book/回西厢/';
    const file = directory + '0.md';
    const localSources = upsertLocalSourceFile([], storedCardWorkspacePath(file), 'applyText $schema xbgetvar <state> varevent').nextSources;
    const { buildToolFailureResult } = createHostToolRequestController({ describeError: error => error.message });
    const calls = [
        ['LS', { path: directory }],
        ['Glob', { path: directory, pattern: '**/*.md' }],
        ['Grep', { path: directory, pattern: 'applyText|\\$schema|xbgetvar|<state>|varevent' }],
        ['Read', { filePath: file }],
    ];
    for (const [name, args] of calls) {
        const call = parameters => callReadableWorkspaceTool(name, parameters, converted => execute(name, converted, { localSources }));
        for (const invalid of [directory, 'workspace']) {
            const submitted = { ...args, scope: invalid };
            await assert.rejects(call(submitted), error => {
                const result = JSON.parse(JSON.stringify(buildToolFailureResult(name, submitted, error)));
                assert.equal(result.ok, false);
                assert.equal(result.error, INVALID_LOOKUP_SCOPE);
                assert.equal(result.parameter, 'scope');
                assert.equal(result.received, invalid);
                assert.deepEqual(result.allowed, ['project', 'local']);
                return true;
            });
        }
        const result = await call({ ...args, scope: 'local' });
        if (name === 'Read') assert.equal(result.content.includes('varevent'), true);
        else assert.equal(result.items.length, 1);
    }
});

test('lookup schemas and runtime share accepted sources without changing defaults or path isolation', () => {
    for (const name of ['LS', 'Glob', 'Grep', 'Read']) {
        const scope = TOOL_DEFINITIONS.find(tool => tool.function.name === name).function.parameters.properties.scope;
        assert.deepEqual(scope.enum, LOOKUP_SCOPES);
        for (const value of scope.enum) assert.equal(normalizeLookupScope(value), value);
    }
    assert.equal(normalizeLookupScope(), 'project');
    assert.equal(normalizeLookupScope(' LOCAL '), 'local');
    assert.throws(() => assertLookupScopePath('local/cards/', 'project'), { message: 'workspace_scope_local_required' });
    assert.throws(() => assertLookupScopePath('scripts/', 'local'), { message: 'workspace_scope_local_only' });
});
