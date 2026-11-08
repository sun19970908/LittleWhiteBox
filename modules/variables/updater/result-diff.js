import { formatPath, parsePath } from '../state2/path.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = value => JSON.stringify(value, (_name, item) => object(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);

function equal(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
    if (object(left) && object(right)) return Object.keys(left).length === Object.keys(right).length
        && Object.keys(left).every(name => Object.hasOwn(right, name) && equal(left[name], right[name]));
    return false;
}

// Exact sequence anchors, including duplicates. Linear-space LCS avoids an
// array-length-squared table; unchanged prefixes/suffixes are removed first.
function anchors(left, right, startLeft, endLeft, startRight, endRight, result) {
    if (startLeft === endLeft || startRight === endRight) return;
    if (endLeft - startLeft === 1) {
        for (let index = startRight; index < endRight; index++) {
            if (left[startLeft] === right[index]) { result.push([startLeft, index]); break; }
        }
        return;
    }
    const candidates = new Set(right.slice(startRight, endRight));
    if (!left.slice(startLeft, endLeft).some(item => candidates.has(item))) return;
    const middle = Math.floor((startLeft + endLeft) / 2), width = endRight - startRight;
    const lengths = (from, to, reverse) => {
        const row = new Uint32Array(width + 1);
        for (let i = from; reverse ? i >= to : i < to; i += reverse ? -1 : 1) {
            let diagonal = 0;
            for (let j = 1; j <= width; j++) {
                const previous = row[j];
                row[j] = left[i] === right[reverse ? endRight - j : startRight + j - 1]
                    ? diagonal + 1 : Math.max(row[j], row[j - 1]);
                diagonal = previous;
            }
        }
        return row;
    };
    const forward = lengths(startLeft, middle, false), backward = lengths(endLeft - 1, middle, true);
    let split = 0;
    for (let j = 1; j <= width; j++) {
        if (forward[j] + backward[width - j] > forward[split] + backward[width - split]) split = j;
    }
    anchors(left, right, startLeft, middle, startRight, startRight + split, result);
    anchors(left, right, middle, endLeft, startRight + split, endRight, result);
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
            let head = 0, tail = 0;
            while (head < Math.min(oldValue.length, newValue.length) && equal(oldValue[head], newValue[head])) head++;
            while (tail < Math.min(oldValue.length, newValue.length) - head
                && equal(oldValue[oldValue.length - tail - 1], newValue[newValue.length - tail - 1])) tail++;
            const endLeft = oldValue.length - tail, endRight = newValue.length - tail;
            const matches = [];
            anchors(oldValue.map(key), newValue.map(key), head, endLeft, head, endRight, matches);
            matches.push([endLeft, endRight]);
            let left = head, right = head;
            for (const [nextLeft, nextRight] of matches) {
                const paired = Math.min(nextLeft - left, nextRight - right);
                for (let i = 0; i < paired; i++) visit(oldValue[left + i], newValue[right + i], [...parts, right + i]);
                for (let i = left + paired; i < nextLeft; i++) visit(oldValue[i], undefined, [...parts, i]);
                for (let i = right + paired; i < nextRight; i++) visit(undefined, newValue[i], [...parts, i]);
                left = nextLeft + 1; right = nextRight + 1;
            }
            return;
        }
        changes.push({ path: formatPath(parts), kind: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed',
            ...(oldValue === undefined ? {} : { before: oldValue }), ...(newValue === undefined ? {} : { after: newValue }) });
    };
    visit(before, after, parsePath(path));
    return changes;
}
