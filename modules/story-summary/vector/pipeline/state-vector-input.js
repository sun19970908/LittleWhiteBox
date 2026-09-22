const R_AGG_MAX_CHARS = 256;

export function buildRAggregateText(atom) {
    const uniq = new Set();
    for (const edge of (atom?.edges || [])) {
        const r = String(edge?.r || '').trim();
        if (!r) continue;
        uniq.add(r);
    }
    const joined = [...uniq].join(' ; ');
    if (!joined) return String(atom?.semantic || '').trim();
    return joined.length > R_AGG_MAX_CHARS ? joined.slice(0, R_AGG_MAX_CHARS) : joined;
}
