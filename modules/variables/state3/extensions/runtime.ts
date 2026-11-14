import type { ValidateFunction } from 'ajv';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';
import { executeScript } from '../../../../shared/common/script-execution.js';
import { activeScript, extensionPath } from './definition.js';
import { assertJson, clone } from '../engine/data.js';
import { diagnostic, reject } from '../engine/diagnostics.js';
import type { Bundle, ExtensionContext, ExtensionTrace, Json, Result, ScriptPhase, Success, UpdateStage } from '../types.js';
import { compileDefinition } from '../definition/compile.js';

export interface ExtensionHost {
    authorize(bundle: Bundle, signal?: AbortSignal, stage?: UpdateStage): Promise<void>;
    requestAuthorization?(bundle: Bundle, signal?: AbortSignal, stage?: UpdateStage): Promise<void>;
    context(): unknown;
    passage(index: number): string;
    apply?(input: unknown, signal?: AbortSignal): Promise<Result>;
}
export interface ExtensionBasis extends ExtensionContext { target: { floor: number; swipeId: number }; signal?: AbortSignal; assertCurrent(): void }

/** One run owns its external facts and trace. Nothing here writes history. */
export function createExtensionRun(bundle: Bundle, basis: ExtensionBasis, host?: ExtensionHost, simulatedPrepared?: Json, validators?: Map<string, ValidateFunction>) {
    const calls: ExtensionTrace[] = [];
    let prepared: Json | undefined = clone(simulatedPrepared), preparedOnce = simulatedPrepared !== undefined;
    async function invoke(kind: 'tool' | ScriptPhase, name: string, input: Json, stage?: UpdateStage, signal?: AbortSignal,
        apply?: (input: unknown) => Promise<Result>): Promise<Json> {
        const path = extensionPath(kind, name);
        const trace: ExtensionTrace = { kind, name, path, input: clone(input) };
        calls.push(trace);
        signal = mergeAbortSignals(basis.signal, signal) ?? undefined;
        try {
            signal?.throwIfAborted(); basis.assertCurrent();
            if (!host) {reject('extension-host', { path });}
            await host.authorize(bundle, signal, stage);
            basis.assertCurrent(); signal?.throwIfAborted();
            const source = kind === 'tool' ? bundle.tools?.[name] : bundle.scripts?.[kind];
            if (!source) {reject('extension-source', { path });}
            const ctx = host.context();
            const context: ExtensionContext = { state: basis.state, target: basis.target,
                text: basis.text ?? host.passage(basis.target.floor), ...(stage ? { stage } : {}), prepared: clone(prepared ?? null),
                tools: clone([...(basis.tools || []), ...calls.filter(call => call.kind === 'tool' && call.output !== undefined)
                    .map(call => ({ name: call.name, input: call.input, output: call.output! }))]) };
            trace.context = context;
            const run = { ...clone(context), rules: clone(bundle.definition), signal,
                ...(kind === 'committed' ? { apply: apply ?? (host.apply ? (input: unknown) => host.apply!(input, signal) : undefined) } : {}) };
            const executed = await executeScript(source, { bindings: { input: clone(input), run, ctx, getContext: () => host.context() }, signal, sourceName: path });
            basis.assertCurrent(); signal?.throwIfAborted();
            const value = executed.missingReturn ? null : executed.result;
            assertJson(value); trace.output = clone(value);
            return value;
        } catch (error) {
            signal?.throwIfAborted();
            basis.assertCurrent();
            const cause = diagnostic(error);
            trace.error = cause.message || cause.code;
            if (error && typeof error === 'object' && 'code' in error && error.code === 'extension-untrusted') {throw error;}
            reject('extension-execution', { path, extension: name, message: trace.error, cause });
        }
    }
    return {
        calls,
        async tool(name: string, args: Json, stage?: UpdateStage, signal?: AbortSignal, testing = false) {
            const definition = bundle.definition.extensions?.tools?.[name];
            if (!definition || !testing && (!definition.enabled || !stage || !definition.stages.includes(stage))) {reject('extension-name', { name });}
            validators ??= compileDefinition(bundle).tools;
            const validate = validators.get(name)!;
            if (!validate(args)) {reject('extension-parameters', { name, errors: clone(validate.errors) });}
            return invoke('tool', name, args, stage, signal);
        },
        async prepare(input: Json, stage?: UpdateStage, signal?: AbortSignal) {
            basis.signal?.throwIfAborted(); signal?.throwIfAborted(); basis.assertCurrent();
            if (!preparedOnce && activeScript(bundle, 'prepare')) {
                prepared = await invoke('prepare', 'prepare', input, stage, signal); preparedOnce = true;
            }
            return prepared;
        },
        async committed(result: Success, stage?: UpdateStage, signal?: AbortSignal, apply?: (input: unknown) => Promise<Result>) {
            if (activeScript(bundle, 'committed')) {
                // The committed state supersedes the pre-commit snapshot.
                basis.state = clone(result.state);
                await invoke('committed', 'committed', JSON.parse(JSON.stringify({ state: result.state, changes: result.changes, actions: result.actions })), stage, signal, apply);
            }
        },
        invoke,
    };
}
export type ExtensionRun = ReturnType<typeof createExtensionRun>;
