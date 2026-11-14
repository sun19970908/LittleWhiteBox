import type { Compiled, Diagnostic, EvaluationContext } from '../types.js';
import { clone, getAt } from './data.js';
import { evaluate, references } from './expressions.js';
import { diagnostic } from './diagnostics.js';
import { createFunctionRunner } from './functions.js';

/** Read-only final-state checks shared by settlement and historical selection warnings. */
export async function validateState(compiled: Compiled, context: EvaluationContext): Promise<Diagnostic[]> {
    const functions = context.functions ?? createFunctionRunner();
    try { return await checkState(compiled, { ...context, functions }); }
    finally { if (!context.functions) {functions.dispose();} }
}

async function checkState(compiled: Compiled, context: EvaluationContext): Promise<Diagnostic[]> {
    context.signal?.throwIfAborted();
    if (!compiled.validate(context.state)) {
        const errors = clone(compiled.validate.errors);
        const paths = (errors || []).map(error => [
            ...error.instancePath.split('/').slice(1).map(part => part.replaceAll('~1', '/').replaceAll('~0', '~')),
            ...('missingProperty' in error.params ? [String(error.params.missingProperty)] : 'additionalProperty' in error.params ? [String(error.params.additionalProperty)] : []),
        ]);
        return [{ code: 'state-schema', errors, fields: [...new Map(paths.map(path => [JSON.stringify(path), path])).values()]
            .map(path => ({ path, value: clone(getAt(context.state, path)) })) }];
    }
    const errors: Diagnostic[] = [];
    for (const [index, constraint] of compiled.definition.constraints.entries()) {
        let issue: Diagnostic | undefined;
        try {
            if (await evaluate(constraint.test, context, ['constraints', String(index), 'test']) !== true) {issue = { code: 'constraint' };}
        } catch (error) { issue = diagnostic(error); }
        context.signal?.throwIfAborted();
        // Restoration has no batch-start state. Leave transition checks to a real
        // settlement, including before() reads inside authored functions.
        if (context.before === undefined && issue && ['before-unavailable', 'function_before_unavailable'].includes(issue.code)) {continue;}
        if (!issue) {continue;}
        const paths = [...new Map(references(constraint.test, compiled.definition).map(path => [JSON.stringify(path), path])).values()];
        errors.push({ ...issue, rule: constraint.id, description: constraint.description,
            fields: paths.map(path => ({ path: clone(path), value: clone(getAt(context.state, path)) })) });
    }
    return errors;
}
