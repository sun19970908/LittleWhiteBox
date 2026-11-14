import { parse } from 'acorn';
import type { Bundle, Expression, ScriptPhase, UpdateStage } from '../types.js';
import { parseScriptBody } from '../../../../shared/common/script-syntax.js';
import { reject } from '../engine/diagnostics.js';
import { SCRIPT_DIRECTORY, SCRIPT_PHASES, TOOL_DIRECTORY } from '../definition/format.js';
import { HANDOFF } from '../../updater/handoff.js';

export const TOOL_CALL_LIMIT = 5;
export const isExtensionToolName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) && !Object.values(HANDOFF).some(reserved => reserved === name);
export const extensionPath = (kind: 'tool' | ScriptPhase, name: string = kind) => kind === 'tool' ? `${TOOL_DIRECTORY}${name}.js` : `${SCRIPT_DIRECTORY}${kind}.js`;
export const activeTools = (bundle: Bundle, stage: UpdateStage) => Object.entries(bundle.definition.extensions?.tools || {})
    .filter(([, tool]) => tool.enabled && tool.stages.includes(stage));
export const activeScript = (bundle: Bundle, phase: ScriptPhase) => bundle.definition.extensions?.scripts?.[phase]?.enabled === true;

export function checkExtensions(bundle: Bundle) {
    const { extensions } = bundle.definition;
    for (const [name, tool] of Object.entries(extensions?.tools || {})) {
        if (tool.enabled && !tool.stages.length) {reject('extension-stages', { path: extensionPath('tool', name) });}
    }
    for (const [kind, definitions, sources] of [
        ['tool', extensions?.tools || {}, bundle.tools || {}],
        ['script', extensions?.scripts || {}, bundle.scripts || {}],
    ] as const) {
        if (!sources || typeof sources !== 'object' || Array.isArray(sources)) {reject('extension-source');}
        for (const name of new Set([...Object.keys(definitions), ...Object.keys(sources)])) {
            const path = extensionPath(kind === 'tool' ? 'tool' : name as ScriptPhase, name);
            if (kind === 'tool' ? !isExtensionToolName(name)
                : !SCRIPT_PHASES.includes(name as ScriptPhase)) {reject('extension-name', { path });}
            const source = (sources as Record<string, string>)[name];
            if (!Object.hasOwn(definitions, name) || typeof source !== 'string' || !source.trim()) {reject('extension-source', { path });}
            try {
                if (kind === 'script' && name === 'calculate') {
                    const ast = parse(`(${source}\n)`, { ecmaVersion: 'latest' });
                    const statement = ast.body[0];
                    if (ast.body.length !== 1 || statement.type !== 'ExpressionStatement'
                        || !['ArrowFunctionExpression', 'FunctionExpression'].includes(statement.expression.type)
                        || ('async' in statement.expression && statement.expression.async)) {reject('extension-source', { path });}
                } else {parseScriptBody(source);}
            } catch (error) {reject('extension-syntax', { path, message: error instanceof Error ? error.message : String(error) });}
        }
    }
}

export function checkPreparedScope(expression: Expression) {
    if (expression.prepared) {reject('prepared-scope');}
    for (const child of expression.args || []) {checkPreparedScope(child);}
}

export function usesPrepared(expression: Expression): boolean {
    return expression.prepared !== undefined || Boolean(expression.args?.some(usesPrepared));
}
