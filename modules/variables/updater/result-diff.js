import { alignArray } from '../shared/array-alignment.js';
import { formatPath, parsePath } from '../state2/path.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function equal(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
    if (object(left) && object(right)) return Object.keys(left).length === Object.keys(right).length
        && Object.keys(left).every(name => Object.hasOwn(right, name) && equal(left[name], right[name]));
    return false;
}

/** Display-only differences. Never fed back into the executor or persisted. */
export function resultDifference(before, after, path) {
    const changes = [];
    const visit = (oldValue, newValue, parts) => {
        if (equal(oldValue, newValue)) return;
        if (object(oldValue) && object(newValue)) {
            for (const name of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
                visit(oldValue[name], newValue[name], [...parts, name]);
            }
            return;
        }
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
            for (const { left, right, removed, added } of alignArray(oldValue, newValue)) {
                const paired = Math.min(removed, added);
                for (let i = 0; i < paired; i++) visit(oldValue[left + i], newValue[right + i], [...parts, right + i]);
                for (let i = paired; i < removed; i++) visit(oldValue[left + i], undefined, [...parts, left + i]);
                for (let i = paired; i < added; i++) visit(undefined, newValue[right + i], [...parts, right + i]);
            }
            return;
        }
        changes.push({ path: formatPath(parts), kind: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed',
            ...(oldValue === undefined ? {} : { before: oldValue }), ...(newValue === undefined ? {} : { after: newValue }) });
    };
    visit(before, after, parsePath(path));
    return changes;
}
