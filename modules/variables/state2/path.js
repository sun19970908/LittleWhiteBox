// State 2 owns path syntax. Runtime paths are segments; strings are boundary/display values.
export const KEY_WILDCARD = Object.freeze({ wildcard: 'key' });
export const INDEX_WILDCARD = Object.freeze({ wildcard: 'index' });
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

export function parsePath(path, { pattern = false } = {}) {
    if (Array.isArray(path)) return path;
    const text = String(path ?? '').trim();
    const parts = [];
    let i = 0;
    const invalid = () => { throw new Error('invalid_variable_path'); };
    const bare = token => {
        if (!token || token !== token.trim()) invalid();
        return pattern && token === '*' ? KEY_WILDCARD : /^\d+$/.test(token) ? Number(token) : token;
    };
    while (i < text.length) {
        if (text[i] === '[') {
            i++;
            const quote = text[i];
            if (quote === '"' || quote === "'") {
                i++;
                let value = '', closed = false;
                while (i < text.length) {
                    const ch = text[i++];
                    if (ch === quote) { closed = true; break; }
                    if (ch !== '\\') { value += ch; continue; }
                    const escape = text[i++];
                    if (escape === quote || escape === '\\' || escape === '/') value += escape;
                    else if ('bfnrt'.includes(escape)) value += { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[escape];
                    else if (escape === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i, i + 4))) {
                        value += String.fromCharCode(parseInt(text.slice(i, i + 4), 16)); i += 4;
                    } else invalid();
                }
                if (!closed || text[i++] !== ']') invalid();
                parts.push(value);
            } else {
                const end = text.indexOf(']', i);
                if (end < 0) invalid();
                const token = text.slice(i, end).trim();
                if (pattern && token === '*') parts.push(INDEX_WILDCARD);
                else if (/^\d+$/.test(token)) parts.push(Number(token));
                else invalid();
                i = end + 1;
            }
        } else {
            const start = i;
            while (i < text.length && !'.[]'.includes(text[i])) i++;
            parts.push(bare(text.slice(start, i)));
        }
        if (text[i] === '.') { i++; if (i === text.length) invalid(); }
        else if (i < text.length && text[i] !== '[') invalid();
    }
    if (!parts.length || parts.some(part => typeof part === 'string' ? !part.length || UNSAFE.has(part)
        : typeof part === 'number' ? !Number.isSafeInteger(part) : !pattern)) invalid();
    // A root is always a variable name, not an array index.
    parts[0] = typeof parts[0] === 'number' ? String(parts[0]) : parts[0];
    return parts;
}

export function formatPath(path) {
    const parts = Array.isArray(path) ? path : parsePath(path, { pattern: true });
    return parts.map((part, index) => {
        if (part?.wildcard === 'index') return '[*]';
        if (part?.wildcard === 'key') return `${index ? '.' : ''}*`;
        if (typeof part === 'number') return `[${part}]`;
        if (/^[^.[\]"'\\*\s]+$/.test(part) && !/^\d+$/.test(part)) return `${index ? '.' : ''}${part}`;
        return `[${JSON.stringify(part)}]`;
    }).join('');
}

export const sameSegment = (left, right) => typeof left !== 'object' && typeof right !== 'object'
    ? String(left) === String(right) : left?.wildcard === right?.wildcard;
export const pathStartsWith = (path, prefix) => prefix.length <= path.length && prefix.every((part, index) => sameSegment(part, path[index]));
export const isArrayIndex = key => /^(0|[1-9]\d*)$/.test(String(key)) && Number(key) < 4294967295;
export const appendPath = (path, key) => formatPath([...parsePath(path, { pattern: true }), key]);
