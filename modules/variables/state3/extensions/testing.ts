import { draftBundle, type Draft } from '../definition/authoring.js';
import { compileDefinition } from '../definition/compile.js';
import { initialize, settle } from '../engine/settle.js';
import { inspectInput } from '../engine/input.js';
import { createFunctionRunner } from '../engine/functions.js';
import { clone } from '../engine/data.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import { createExtensionRun, type ExtensionHost } from './runtime.js';
import { extensionPath } from './definition.js';
import type { ExtensionContext, ExtensionDetails, Failure, Json, Result, RunOptions, ScriptPhase } from '../types.js';

export interface ExtensionTest extends Partial<ExtensionContext> { kind: 'tool' | ScriptPhase; name?: string; input: Json }
export type ExtensionTestResult = Failure | { ok: true; output: Json; extensions: ExtensionDetails };
export async function testDraftExtension(draft: Draft, test: ExtensionTest, options: RunOptions, host: ExtensionHost,
    assertCurrent: () => void): Promise<ExtensionTestResult> {
    let calls: ExtensionDetails['calls'] = [];
    try {
        const compiled = compileDefinition(draftBundle(draft));
        const initial = test.state === undefined ? await initialize(compiled, options) : { ok: true as const, state: test.state };
        if (!initial.ok) {return initial;}
        const { state } = initial;
        const name = test.kind === 'tool' ? test.name! : test.kind;
        if (test.kind === 'calculate') {
            const runner = createFunctionRunner();
            const input = { submission: test.input, prepared: test.prepared ?? null };
            const path = extensionPath('calculate');
            const stage = test.stage ?? options.stage;
            calls = [{ kind: 'calculate', name, path, input, context: { state: clone(state), beforeState: clone(test.beforeState ?? state), ...(stage ? { stage } : {}) } }];
            try {
                const source = compiled.bundle.scripts?.calculate;
                if (!source) {reject('extension-source', { path });}
                const output = await runner.run({ id: 'calculate', source, input, state, beforeState: test.beforeState ?? state,
                    reads: Object.keys(compiled.definition.initial).map(key => [key]), signal: options.signal });
                assertCurrent();
                calls[0].output = output;
                return { ok: true, output, extensions: { calls } };
            } catch (error) {
                calls[0].error = error instanceof Error ? error.message : JSON.stringify(error);
                return { ok: false, diagnostics: [{ ...diagnostic(error), path }], extensions: { calls } };
            } finally {runner.dispose();}
        }
        const target = test.target ?? { floor: -1, swipeId: 0 }, stage = test.stage ?? options.stage;
        const run = createExtensionRun(compiled.bundle, { ...clone(test), state: clone(state), target, signal: options.signal, assertCurrent }, host, test.prepared, compiled.tools);
        calls = run.calls;
        // A committed test's follow-up batch is a draft trial: it never publishes to the chat or replaces the live result.
        let trialState = clone(state);
        const trialApply = async (input: unknown): Promise<Result> => {
            assertCurrent();
            const checked = inspectInput(clone(input), compiled, stage);
            if (!checked.ok) {return checked;}
            const nested = createExtensionRun(compiled.bundle, { state: clone(trialState), target, text: test.text, signal: options.signal, assertCurrent }, host, undefined, compiled.tools);
            let prepared: Json | undefined;
            try { prepared = await nested.prepare(checked.input, stage, options.signal); }
            catch (error) { calls.push(...nested.calls); return { ok: false, diagnostics: [diagnostic(error)], extensions: { calls: clone(nested.calls) } }; }
            calls.push(...nested.calls);
            const result = await settle(compiled, trialState, input, { signal: options.signal, stage, prepared });
            calls.push(...result.extensions?.calls || []);
            if (!result.ok) {return result;}
            trialState = clone(result.state);
            return { ...result, committed: false };
        };
        const output = test.kind === 'tool'
            ? await run.tool(name, test.input, stage ?? compiled.definition.extensions?.tools?.[name]?.stages[0], options.signal, true)
            : await run.invoke(test.kind, name, test.input, stage, options.signal, test.kind === 'committed' ? trialApply : undefined);
        return { ok: true, output, extensions: { calls } };
    } catch (error) {return { ok: false, diagnostics: [diagnostic(error)], extensions: { calls } };}
}
