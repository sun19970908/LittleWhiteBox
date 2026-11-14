import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { createExtensionRun } from '../extensions/runtime.js';
import { compileDefinition } from '../definition/compile.js';
import { equipmentExample } from '../definition/example.js';
import { settle } from '../engine/settle.js';
import { accepted, fixture } from './fixture.js';
import { runJavaScriptApi } from '../../../assistant/runtime-src/jsapi-runtime.js';
import { state3JsApiNamespace, withExtensionJsApiManifest } from '../skill/public-api.js';
import type { Bundle, Expression, Path } from '../types.js';

// 验收契约：
// D4：扩展失败保留原错误和来源，诊断不携带请求配置；代价：错误归因、凭据泄露。
// D5：同一领域异常经助手工具抛出或返回时都保留字段详情；代价：盲目重试修改。
// D6：保存失败保留底层原因且不否认已生效的状态；代价：重复执行、丢数据。
// D7：表达式失败定位到实际子表达式和操作数，且不提交状态；代价：修错规则。
test('D4: host extension failures retain typed causes and source without request configuration', async () => {
    const bundle = equipmentExample();
    const original = Object.assign(new TypeError('missing inventory'), { code: 'INVENTORY_MISSING', status: 422,
        cause: new Error('missing row'), request: { headers: { authorization: 'private-token' } } });
    for (const kind of ['prepare', 'committed', 'tool'] as const) {
        bundle.scripts = { prepare: 'throw ctx.problem;', committed: 'throw ctx.problem;' };
        bundle.tools = { inventory: 'throw ctx.problem;' };
        const run = createExtensionRun(bundle, { state: {}, target: { floor: 0, swipeId: 0 }, assertCurrent() {} },
            { authorize: async () => {}, context: () => ({ problem: original }), passage: () => '' });
        await assert.rejects(run.invoke(kind, kind === 'tool' ? 'inventory' : kind, {}), error => {
            const issue = diagnostic(error);
            assert.equal(issue.code, 'extension-execution');
            assert.equal(issue.message, original.message);
            const cause = issue.cause as Record<string, unknown>;
            assert.equal(cause.code, original.code); assert.equal(cause.errorName, original.name);
            assert.equal(cause.status, 422); assert.equal(cause.stack, original.stack);
            assert.equal((cause.cause as { message: string }).message, 'missing row');
            assert.equal(JSON.stringify(issue).includes('private-token'), false);
            return true;
        });
    }
});

test('D5: assistant tool preserves thrown domain diagnostics and safely serializes nested errors', async () => {
    let original!: Error;
    try { compileDefinition({ definition: {}, functions: {} }); } catch (error) { original = error as Error; }
    const result = await runJavaScriptApi({ code: 'return await st.state3.prepareRuleImport();', purpose: 'Inspect rules', expectedOutput: 'Diagnostic',
        manifest: withExtensionJsApiManifest(), st: { state3: state3JsApiNamespace({ prepareRuleImport() { throw original; } }) } });
    assert.equal(result.ok, false);
    const transferred = (result.execution as { error?: Record<string, unknown> }).error!;
    assert.equal(transferred.code, 'definition-schema');
    assert.deepEqual(transferred.errors, diagnostic(original).errors);
    assert.deepEqual(JSON.parse(JSON.stringify(result)).execution.error, transferred);
});

test('D6: persistence diagnostics keep status and cause without replaying committed actions', async () => {
    const h = fixture(); accepted(await h.service.enable(equipmentExample()));
    const publish = h.adapter.publish;
    h.adapter.publish = (...args) => { publish(...args); return async () => { reject('save-unconfirmed', { status: 503 }); }; };
    const result = accepted(await h.service.apply([{ action: 'unequip', params: {} }]));
    assert.equal(result.committed, true); assert.equal(result.saved, false);
    assert.equal(result.persistence?.status, 503);
    assert.equal((h.saved().state as { hero: { amulet: boolean } }).hero.amulet, false);
    assert.equal(result.actions.length, 1);
});

test('D7: expression diagnostics identify nested operands and leave candidate input untouched', async () => {
    const locations: [Path, (bundle: Bundle, expression: Expression) => void][] = [
        [['rules', '3', 'value'], (bundle, value) => { bundle.definition.rules[3].value = value; }],
        [['actions', '0', 'requires'], (bundle, value) => { bundle.definition.actions[0].requires = value; }],
        [['actions', '0', 'effects', '0', 'value'], (bundle, value) => { bundle.definition.actions[0].effects[0].value = value; }],
        [['actions', '0', 'conversions', '0', 'value'], (bundle, value) => {
            bundle.definition.actions[0].parameters = { type: 'object', additionalProperties: false, properties: { count: { type: 'number' } } };
            bundle.definition.actions[0].conversions = [{ path: ['count'], value }];
        }],
        [['triggers', '0', 'when'], (bundle, value) => {
            bundle.definition.triggers = [{ id: 'trigger', description: 'Trigger', when: value, effects: [{ path: ['hero', 'health'], value: { literal: 1 } }] }];
        }],
        [['triggers', '0', 'effects', '0', 'value'], (bundle, value) => {
            bundle.definition.triggers = [{ id: 'trigger', description: 'Trigger', when: { literal: true }, effects: [{ path: ['hero', 'health'], value }] }];
        }],
        [['constraints', '0', 'test'], (bundle, value) => { bundle.definition.constraints[0].test = value; }],
    ];
    for (const [op, actual, code] of [['add', 'bad', 'expression-type'], ['divide', 0, 'division-zero']] as const) {
        for (const [path, assign] of locations) {
            const bundle = equipmentExample();
            assign(bundle, { op: 'add', args: [{ literal: 5 }, { op, args: [{ literal: 8 }, { literal: actual }] }] });
            const before = structuredClone(bundle.definition.initial);
            const result = await settle(compileDefinition(bundle), before, [{ action: 'unequip', params: {} }]);
            assert.equal(result.ok, false);
            const issue = result.diagnostics[0];
            assert.equal(issue.code, code); assert.equal(issue.operator, op); assert.equal(issue.operand, 1);
            assert.equal(issue.actual, actual);
            assert.deepEqual(issue.expressionPath, [...path, 'args', '1']);
            assert.deepEqual(before, bundle.definition.initial);
        }
    }
});
