import { errorDetails } from '../../../shared/common/error-details.js';

const INSPECT_LIMITS = { depth: 3, items: 40, keys: 40, chars: 4000 };

export function normalizeJavaScriptApiOutput(value, requestKind) {
    const limits = requestKind === 'inspect' ? INSPECT_LIMITS : { depth: Infinity, items: Infinity, keys: Infinity, chars: Infinity };
    const ancestors = new WeakSet();
    let truncated = false;
    function visit(item, depth) {
        if (item === undefined) return '';
        if (item === null || typeof item !== 'object') {
            if (typeof item === 'string' && item.length > limits.chars) {
                truncated = true; return `${item.slice(0, limits.chars)}… [truncated ${item.length - limits.chars} chars]`;
            }
            if (typeof item === 'bigint') return `[BigInt:${item}]`;
            if (typeof item === 'symbol') return `[Symbol:${item.description || ''}]`;
            if (typeof item === 'function') return `[Function:${item.name || 'anonymous'}]`;
            return item;
        }
        if (item instanceof Error) return visit(errorDetails(item), depth);
        if (typeof Element !== 'undefined' && item instanceof Element) return `[Element:${item.tagName}]`;
        if (item instanceof Date) return item.toISOString();
        if (item instanceof RegExp) return String(item);
        if (ancestors.has(item)) return '[Circular]';
        if (depth >= limits.depth) { truncated = true; return Array.isArray(item) ? `[MaxDepth:Array(${item.length})]` : '[MaxDepth:Object]'; }
        ancestors.add(item);
        try {
            if (Array.isArray(item)) {
                const result = item.slice(0, limits.items).map(child => visit(child, depth + 1));
                if (item.length > limits.items) { truncated = true; result.push(`[... ${item.length - limits.items} more items]`); }
                return result;
            }
            const keys = Object.keys(item), result = {};
            for (const key of keys.slice(0, limits.keys)) {
                Object.defineProperty(result, key, { value: visit(item[key], depth + 1), enumerable: true, configurable: true, writable: true });
            }
            if (keys.length > limits.keys) { truncated = true; result.__truncatedKeys__ = keys.length - limits.keys; }
            return result;
        } finally { ancestors.delete(item); }
    }
    return { output: visit(value, 0), truncated };
}
