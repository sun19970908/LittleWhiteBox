import { parseScriptBody, childNodes } from '../../../shared/common/script-syntax.js';
export { childNodes } from '../../../shared/common/script-syntax.js';
import { JSAPI_INVALID_BODY } from '../shared/jsapi-contract.js';

const EFFECTS = new Set(['write', 'ui', 'network', 'exec']);
const INSPECT = new Set(['Object.keys', 'Object.values', 'Object.entries', 'Array.isArray']);
const PURE = new Set([...INSPECT, 'JSON.stringify', 'JSON.parse', 'Array.from', 'Object.hasOwn', 'Object.is',
    'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
const READ_METHODS = new Set(['at', 'concat', 'entries', 'every', 'filter', 'find', 'findIndex', 'findLast',
    'findLastIndex', 'flat', 'flatMap', 'forEach', 'includes', 'indexOf', 'join', 'keys', 'lastIndexOf',
    'map', 'reduce', 'reduceRight', 'slice', 'some', 'values', 'toString', 'trim', 'trimStart', 'trimEnd',
    'startsWith', 'endsWith', 'substring', 'substr', 'split', 'toLowerCase', 'toUpperCase', 'charAt',
    'charCodeAt', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'get', 'has']);
const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
    'set', 'add', 'delete', 'clear']);
const OBJECT_WRITES = new Set(['Object.assign', 'Object.defineProperty', 'Object.defineProperties',
    'Object.setPrototypeOf', 'Object.freeze', 'Object.seal', 'Object.preventExtensions',
    'Reflect.set', 'Reflect.deleteProperty', 'Reflect.defineProperty', 'Reflect.setPrototypeOf']);
const LOCAL = Object.freeze({ local: true, path: '' });
const UNKNOWN = Object.freeze({ local: false, path: '' });
const PROMISE_CALLBACKS = new Map([['then', [0, 1]], ['catch', [0]], ['finally', [0]]]);
// Callback positions are shared by effect analysis and execution instrumentation.
const CALLBACK_FUNCTIONS = new Map([
    ['Array.from', [1]], ['JSON.parse', [1]], ['JSON.stringify', [1]],
]);
const CALLBACK_METHODS = new Map([
    ...['every', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap',
        'forEach', 'map', 'reduce', 'reduceRight', 'some', 'sort', 'toSorted'].map(method => [method, [0]]),
    ['replace', [1]], ['replaceAll', [1]],
    ...PROMISE_CALLBACKS,
]);

function mergeOrigins(before, after) {
    return {
        local: before.local && after.local,
        path: before.path === after.path ? before.path : '',
        dataType: before.dataType === after.dataType ? before.dataType : '',
        function: before.function && after.function,
        async: before.async && after.async,
    };
}

export function parseJavaScriptApi(code) {
    try { return parseScriptBody(code); }
    catch (error) { if (error.loc) throw error; throw new SyntaxError(JSAPI_INVALID_BODY, { cause: error }); }
}

function propertyName(node) {
    if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
    return node.property?.type === 'Literal' ? String(node.property.value) : '';
}

// This is an operation classifier, not a JavaScript sandbox or a data validator.
// Unresolved calls require confirmation; ordinary data access is evaluated by JS.
export function analyzeJavaScriptApiRequest({ code = '', manifest = {} } = {}) {
    let body, tokens;
    try { ({ body, tokens } = parseJavaScriptApi(String(code))); }
    catch (error) {
        return { requestKind: 'unknown', usedApis: [], calledApis: [], calledApiSemantics: {},
            hasWriteSyntax: false, hasInspectSyntax: false, validationErrors: [error.message] };
    }
    const scopes = [new Map()], used = new Set(), called = new Set();
    const functionScopes = [scopes[0]];
    const callbackCalls = [];
    let effect = false, unknownCall = false, inspect = false, returned = false;
    const semantics = manifest.apiSemantics || {};
    const asyncPaths = new Set(manifest.asyncPaths || []);
    const lookup = name => {
        for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
        return { local: false, path: name === 'getContext' ? 'st.extensions.getContext' : name };
    };
    const origin = node => {
        if (!node) return UNKNOWN;
        if (node.type === 'ChainExpression') return origin(node.expression);
        if (node.type === 'AwaitExpression') {
            const value = origin(node.argument);
            return value.dataType === 'promise' ? UNKNOWN : value;
        }
        if (node.type === 'Identifier') return lookup(node.name);
        if (node.type === 'Literal') return { ...LOCAL, dataType: typeof node.value };
        if (node.type === 'ArrayExpression') return { ...LOCAL, dataType: 'array' };
        if (node.type === 'TemplateLiteral') return { ...LOCAL, dataType: 'string' };
        if (['ObjectExpression', 'BinaryExpression'].includes(node.type)) return LOCAL;
        if (['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(node.type)) return { ...LOCAL, function: true, async: node.async };
        if (node.type === 'MemberExpression') {
            const base = origin(node.object), key = propertyName(node);
            const path = base.path && key ? `${base.path}.${key}` : '';
            return { local: false, path, dataType: ['ctx.chat', 'ctx.characters'].includes(path) ? 'array' : '' };
        }
        if (node.type === 'CallExpression') {
            const callee = origin(node.callee);
            if (asyncPaths.has(callee.path) || callee.async || (node.callee.type === 'MemberExpression'
                && PROMISE_CALLBACKS.has(propertyName(node.callee)) && origin(node.callee.object).dataType === 'promise')) {
                return { ...UNKNOWN, dataType: 'promise' };
            }
            if (callee.path === 'st.extensions.getContext') return { local: false, path: 'ctx' };
            if (['Object.values', 'Object.entries', 'Array.from'].includes(callee.path)) return { ...UNKNOWN, dataType: 'array' };
            if (['Object.keys', 'JSON.parse'].includes(callee.path)) return { ...LOCAL, dataType: callee.path === 'Object.keys' ? 'array' : '' };
            if (['JSON.stringify', 'String'].includes(callee.path)) return { ...LOCAL, dataType: 'string' };
            return UNKNOWN;
        }
        return UNKNOWN;
    };
    const bind = (pattern, value, scope = scopes.at(-1)) => {
        if (!pattern) return;
        if (pattern.type === 'Identifier') scope.set(pattern.name, scope.has(pattern.name) ? mergeOrigins(scope.get(pattern.name), value) : value);
        else if (pattern.type === 'AssignmentPattern') bind(pattern.left, UNKNOWN, scope);
        else if (pattern.type === 'RestElement') bind(pattern.argument, value, scope);
        else if (pattern.type === 'ObjectPattern') for (const prop of pattern.properties) {
            const key = !prop.computed && prop.key?.type === 'Identifier' ? prop.key.name
                : prop.key?.type === 'Literal' ? String(prop.key.value) : '';
            bind(prop.value || prop.argument, { local: false, path: value.path && key ? `${value.path}.${key}` : '' }, scope);
        }
        else if (pattern.type === 'ArrayPattern') for (const item of pattern.elements) bind(item, UNKNOWN, scope);
    };
    const record = (path, isCall = false) => {
        if (/^(ctx|st)(\.|$)/.test(path)) { used.add(path); if (isCall) called.add(path); }
    };
    const assign = (target, value) => {
        if (!target) return;
        if (target.type === 'Identifier') {
            for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(target.name)) {
                // A branch or callback may not run. Never erase a possible host alias.
                scopes[i].set(target.name, mergeOrigins(scopes[i].get(target.name), value));
                break;
            }
        } else if (target.type === 'Property') assign(target.value, UNKNOWN);
        else if (target.type === 'AssignmentPattern') assign(target.left, UNKNOWN);
        else if (['ObjectPattern', 'ArrayPattern', 'RestElement'].includes(target.type)) {
            for (const child of childNodes(target)) assign(child, UNKNOWN);
        }
    };
    const writes = target => {
        if (!target) return;
        if (target.type === 'MemberExpression' && !origin(target.object).local) effect = true;
        else if (target.type === 'Identifier' && !scopes.some(scope => scope.has(target.name))) effect = true;
        else if (['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement', 'Property'].includes(target.type)) {
            for (const child of childNodes(target)) writes(child);
        }
    };
    const analyzeCallbacks = (node, path) => {
        const method = node.callee.type === 'MemberExpression' ? propertyName(node.callee) : '';
        const receiver = node.callee.type === 'MemberExpression' ? origin(node.callee.object) : UNKNOWN;
        const indexes = CALLBACK_FUNCTIONS.get(path)
            || (PROMISE_CALLBACKS.has(method) || ['array', 'string'].includes(receiver.dataType)
                ? CALLBACK_METHODS.get(method) : undefined);
        if (!indexes || !node.arguments.length) return;
        // Keep the original callee/optional chain. Only its argument list is instrumented,
        // after spread expansion, so callback positions and JS evaluation order stay intact.
        const opening = tokens.find(token => token.start >= node.callee.end && token.type.label === '(');
        callbackCalls.push({ start: node.start, end: node.end, argumentsStart: opening.end, indexes });
        if (node.arguments.some(argument => argument.type === 'SpreadElement')) {
            unknownCall = true;
            return;
        }
        for (const index of indexes) {
            const argument = node.arguments[index];
            if (!argument || argument.type === 'Literal' || argument.type === 'ArrayExpression') continue;
            const callback = origin(argument);
            if (callback.path === 'undefined' || callback.dataType) continue;
            record(callback.path, true);
            if (EFFECTS.has(semantics[callback.path])) effect = true;
            else if (semantics[callback.path] !== 'read' && !PURE.has(callback.path) && !callback.function) unknownCall = true;
        }
    };
    function visit(node, functionDepth = 0) {
        if (!node) return;
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
            scopes.push(new Map());
            functionScopes.push(scopes.at(-1));
            for (const param of node.params) { bind(param, UNKNOWN); visit(param, functionDepth + 1); }
            visit(node.body, functionDepth + 1);
            scopes.pop();
            functionScopes.pop();
            return;
        }
        if (node.type === 'BlockStatement') {
            scopes.push(new Map());
            for (const item of node.body) if (item.type === 'FunctionDeclaration') bind(item.id, origin(item));
            for (const item of node.body) visit(item, functionDepth);
            scopes.pop(); return;
        }
        if (node.type === 'VariableDeclaration') {
            for (const declaration of node.declarations) {
                visit(declaration.init, functionDepth);
                bind(declaration.id, origin(declaration.init), node.kind === 'var' ? functionScopes.at(-1) : scopes.at(-1));
                // Defaults and computed destructuring keys can themselves call APIs.
                visit(declaration.id, functionDepth);
            }
            return;
        }
        if (node.type === 'ReturnStatement' && functionDepth === 0) returned = true;
        if (['ForOfStatement', 'ForInStatement'].includes(node.type) && node.left.type !== 'VariableDeclaration') {
            writes(node.left);
            assign(node.left, UNKNOWN);
        }
        if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression' || (node.type === 'UnaryExpression' && node.operator === 'delete')) {
            writes(node.left || node.argument);
        }
        if (node.type === 'UnaryExpression' && node.operator === 'typeof') inspect = true;
        if (node.type === 'ImportExpression') unknownCall = true;
        if (node.type === 'TaggedTemplateExpression') {
            const path = origin(node.tag).path;
            record(path, true);
            if (EFFECTS.has(semantics[path])) effect = true;
            else unknownCall = true;
        }
        if (node.type === 'CallExpression' || node.type === 'NewExpression') {
            const callee = origin(node.callee), path = callee.path;
            record(path, true);
            const semantic = semantics[path];
            if (EFFECTS.has(semantic)) effect = true;
            else if (semantic === 'read' || path === 'st.extensions.getContext') { /* documented read */ }
            else if (OBJECT_WRITES.has(path)) { if (!origin(node.arguments[0]).local) effect = true; }
            else if (PURE.has(path) || /^Math\.[^.]+$/.test(path)) { if (INSPECT.has(path)) inspect = true; }
            else if (callee.function) { /* its body is visited separately */ }
            else if (node.callee.type === 'MemberExpression') {
                const method = propertyName(node.callee);
                if (MUTATORS.has(method)) { if (!origin(node.callee.object).local) effect = true; }
                else if (PROMISE_CALLBACKS.has(method) && origin(node.callee.object).dataType === 'promise') { /* callbacks are classified below */ }
                else if (!READ_METHODS.has(method) || !['array', 'string'].includes(origin(node.callee.object).dataType)) unknownCall = true;
            } else unknownCall = true;
            analyzeCallbacks(node, path);
        }
        if (node.type === 'Identifier' || node.type === 'MemberExpression') record(origin(node).path);
        for (const child of childNodes(node)) visit(child, functionDepth);
        if (node.type === 'AssignmentExpression') assign(node.left, origin(node.right));
    }
    visit(body);
    const calledApis = [...called].sort();
    return { requestKind: effect ? 'effect' : unknownCall ? 'unknown' : inspect ? 'inspect' : 'read', callbackCalls,
        usedApis: [...used].sort(), calledApis,
        calledApiSemantics: Object.fromEntries(calledApis.filter(path => semantics[path]).map(path => [path, semantics[path]])),
        hasWriteSyntax: effect, hasInspectSyntax: inspect,
        validationErrors: returned ? [] : ['Return the final result from the script itself; a callback return is not the script result.'] };
}
