// Frozen v1 path semantics, used only while importing v1 records.
// Retire together with v1 record/log import support. No execution or replay lives here.
import { KEY_WILDCARD, INDEX_WILDCARD } from './path.js';

export function parseV1Path(path, pattern = false) {
    const text = String(path || '');
    const parts = [];
    let buffer = '', i = 0;
    const add = (value, bracket = false) => {
        if (pattern && value === '*') parts.push(bracket ? INDEX_WILDCARD : KEY_WILDCARD);
        else parts.push(/^\d+$/.test(value) ? Number(value) : value);
    };
    while (i < text.length) {
        const ch = text[i];
        if (ch === '.') {
            if (buffer) { add(buffer); buffer = ''; }
            i++;
        } else if (ch === '[') {
            if (buffer) { add(buffer); buffer = ''; }
            i++;
            let value = '';
            if (text[i] === '"' || text[i] === "'") {
                const quote = text[i++];
                while (i < text.length && text[i] !== quote) value += text[i++];
                i++;
            } else while (i < text.length && text[i] !== ']') value += text[i++];
            if (text[i] === ']') i++;
            add(value.trim(), true);
        } else { buffer += ch; i++; }
    }
    if (buffer) add(buffer);
    if (typeof parts[0] === 'number') parts[0] = String(parts[0]);
    return parts;
}

export function upgradeV1Record(record) {
    return { ...record, v: 2, entries: record.entries.map(entry => ({
        ...entry,
        ...(entry.rules ? { rules: entry.rules.map(item => ({ ...item, path: parseV1Path(item.path, true) })) } : {}),
        ops: entry.ops.map(item => ({ ...item, path: parseV1Path(item.path) })),
    })) };
}
