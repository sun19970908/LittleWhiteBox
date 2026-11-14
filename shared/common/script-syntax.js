import { parse } from 'acorn';

export function parseScriptBody(code) {
    const prefix = 'async function __xb__() {\n';
    const source = prefix + code + '\n}', tokens = [];
    let ast;
    try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', onToken: tokens }); }
    catch (error) {
        if (error.loc) {
            error.loc = { line: Math.max(1, error.loc.line - 1), column: error.loc.column };
            error.pos = Math.max(0, error.pos - prefix.length);
            error.message = error.message.replace(/\(\d+:\d+\)$/, `(${error.loc.line}:${error.loc.column})`);
        }
        throw error;
    }
    if (ast.body.length !== 1 || ast.body[0].end !== source.length) throw new SyntaxError('Invalid JavaScript function body');
    return { body: ast.body[0].body, offset: prefix.length, tokens };
}

export function childNodes(node) {
    return Object.values(node).flatMap(value => Array.isArray(value) ? value : [value])
        .filter(value => value && typeof value === 'object' && typeof value.type === 'string');
}
