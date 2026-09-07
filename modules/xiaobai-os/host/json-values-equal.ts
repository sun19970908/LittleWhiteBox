type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Compares JSON-shaped values without treating object key order as data.
 * Arrays remain ordered because their order is part of the persisted model.
 */
export function jsonValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {return true;}

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {return false;}
        return left.every((value, index) => jsonValuesEqual(value, right[index]));
    }

    if (!isRecord(left) || !isRecord(right)) {return false;}
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) {return false;}
    return leftKeys.every(
        (key, index) => key === rightKeys[index] && jsonValuesEqual(left[key], right[key]),
    );
}
