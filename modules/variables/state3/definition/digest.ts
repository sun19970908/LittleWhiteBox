import sha256 from 'js-sha256';

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) {return value.map(canonical);}
    if (value && typeof value === 'object') {return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));}
    return value;
}

export const digest = (value: unknown) => sha256.sha256(JSON.stringify(canonical(value)));
