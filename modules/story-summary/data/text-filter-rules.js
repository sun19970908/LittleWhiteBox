// Pure shared projection: generation, L0 extraction and maintenance evidence
// apply the same exclusions. Callers own configuration and raw-source access.
export function applyTextFilterRules(text, rules) {
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let result = String(text || '');
    for (const rule of rules || []) {
        const start = rule.start ?? '';
        const end = rule.end ?? '';
        if (start && end) result = result.replace(new RegExp(escape(start) + '[\\s\\S]*?' + escape(end), 'gi'), '');
        else if (start) {
            const at = result.toLowerCase().indexOf(start.toLowerCase());
            if (at !== -1) result = result.slice(0, at);
        } else if (end) {
            const at = result.toLowerCase().indexOf(end.toLowerCase());
            if (at !== -1) result = result.slice(at + end.length);
        }
    }
    return rules?.length ? result.trim() : result;
}
