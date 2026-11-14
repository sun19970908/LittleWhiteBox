// Only diagnostic fields cross tool/Worker boundaries. Request/configuration
// objects attached by clients are not part of an error report.
export function errorDetails(error) {
    const ancestors = new WeakSet();
    function value(item) {
        if (item === null || ['string', 'boolean', 'undefined'].includes(typeof item)) return item;
        if (typeof item === 'number') return Number.isFinite(item) ? item : String(item);
        if (typeof item !== 'object') return String(item);
        if (ancestors.has(item)) return '[Circular]';
        if (item instanceof Error) return describe(item);
        ancestors.add(item);
        try {
            return Array.isArray(item) ? item.map(value) : Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(item))
                .filter(([, descriptor]) => descriptor.enumerable && 'value' in descriptor)
                .map(([key, descriptor]) => [key, value(descriptor.value)]));
        } finally { ancestors.delete(item); }
    }
    function describe(item) {
        if (!item || typeof item !== 'object') return { message: String(item) };
        if (ancestors.has(item)) return { message: '[Circular]' };
        ancestors.add(item);
        try {
            const { code, message, name, stack, status, details, cause } = item;
            const fields = { errorName: name, stack, code, status, ...(message === code ? {} : { message }) };
            const result = { ...Object.fromEntries(Object.entries(fields).filter(([, entry]) => entry !== undefined)),
                ...(details && typeof details === 'object' ? value(details) : {}) };
            if (cause !== undefined) result.cause = cause && typeof cause === 'object' && !cause.name ? value(cause) : describe(cause);
            return result;
        } finally { ancestors.delete(item); }
    }
    return describe(error);
}
