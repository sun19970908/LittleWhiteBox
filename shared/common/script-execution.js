import { childNodes, parseScriptBody } from './script-syntax.js';

function abortError() {
    const error = new Error('Script cancelled');
    error.code = 'script-aborted';
    return error;
}

// Cooperative checkpoints preserve normal JS evaluation. They are not a sandbox:
// synchronous native calls cannot be preempted, and started host effects cannot be undone.
export async function executeScript(code, { bindings = {}, signal, callbackCalls = [], sourceName = 'lwb-script.js' }) {
    const { body, offset } = parseScriptBody(code);
    let name = '__xb_control';
    while (code.includes(name)) name += '_';
    const guard = `${name}.check();`;
    const calls = new Map(callbackCalls.map(call => [`${call.start}:${call.end}`, call]));
    const callbacks = new WeakMap();
    const slice = (start, end) => code.slice(start - offset, end - offset);
    function render(node) {
        if (node.type === 'CallbackArguments') {
            const values = node.arguments.map(argument => argument.type === 'SpreadElement'
                ? `...(${render(argument.argument)})` : `(${render(argument)})`).join(',');
            return `...${name}.callbacks([${values}],${JSON.stringify(node.indexes)})`;
        }
        if (node.type === 'AwaitExpression') return `${name}.resume(await ${name}.wait((${render(node.argument)})))`;
        if (node.type === 'BlockStatement') {
            let cursor = node.start + 1, result = '{';
            for (const statement of node.body) {
                result += slice(cursor, statement.start) + (statement.directive ? '' : guard) + render(statement);
                cursor = statement.end;
            }
            return result + slice(cursor, node.end - 1) + (node.body.length ? '' : guard) + '}';
        }
        let cursor = node.start, result = '';
        const call = calls.get(`${node.start}:${node.end}`);
        const children = (call && (node.type === 'CallExpression' || node.type === 'NewExpression')
            ? [node.callee, { type: 'CallbackArguments', start: call.argumentsStart, end: node.end - 1,
                arguments: node.arguments, indexes: call.indexes }]
            : childNodes(node)).sort((a, b) => a.start - b.start || b.end - a.end);
        for (const child of children) {
            if (child.start < cursor) continue;
            let content = render(child);
            if (child === node.body && child.type !== 'BlockStatement') {
                if (node.type === 'ArrowFunctionExpression') content = `(${name}.check(),${content})`;
                else if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'].includes(node.type)) content = `{${guard}${content}}`;
            }
            if (node.type === 'SwitchCase' && node.consequent.includes(child)) content = guard + content;
            result += slice(cursor, child.start) + content;
            cursor = child.end;
        }
        return result + slice(cursor, node.end);
    }
    const control = {
        missing: Symbol('missing script result'),
        check() { if (signal?.aborted) throw abortError(); },
        resume(value) { this.check(); return value; },
        callbacks(values, indexes) {
            for (const index of indexes) {
                const callback = values[index];
                if (typeof callback !== 'function') continue;
                if (!callbacks.has(callback)) callbacks.set(callback, new Proxy(callback, {
                    apply(target, receiver, args) {
                        control.check();
                        return Reflect.apply(target, receiver, args);
                    },
                }));
                values[index] = callbacks.get(callback);
            }
            return values;
        },
        wait(value) {
            return new Promise((resolve, reject) => {
                const abort = () => reject(abortError());
                signal?.addEventListener('abort', abort, { once: true });
                if (signal?.aborted) abort();
                Promise.resolve(value).then(result => {
                    signal?.removeEventListener('abort', abort);
                    if (signal?.aborted) reject(abortError()); else resolve(result);
                }, error => {
                    signal?.removeEventListener('abort', abort);
                    reject(signal?.aborted ? abortError() : error);
                });
            });
        },
    };
    control.check();
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const program = render(body).slice(1, -1);
    const runner = new AsyncFunction(...Object.keys(bindings), name,
        `"use strict";${program}\nreturn ${name}.missing;\n//# sourceURL=${sourceName}`);
    const result = await control.wait(runner(...Object.values(bindings), control));
    control.check();
    return { result, missingReturn: result === control.missing };
}
