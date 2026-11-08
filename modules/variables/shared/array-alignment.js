const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = value => JSON.stringify(value, (_name, item) => object(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);

// Exact sequence anchors including duplicates, using linear-space LCS.
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

/** Changed spans between exact anchors. Indices refer to their respective input. */
export function alignArray(before, after) {
    const leftKeys = before.map(key), rightKeys = after.map(key);
    let head = 0, tail = 0;
    while (head < Math.min(before.length, after.length) && leftKeys[head] === rightKeys[head]) head++;
    while (tail < Math.min(before.length, after.length) - head
        && leftKeys[before.length - tail - 1] === rightKeys[after.length - tail - 1]) tail++;
    const endLeft = before.length - tail, endRight = after.length - tail, matches = [];
    anchors(leftKeys, rightKeys, head, endLeft, head, endRight, matches);
    matches.push([endLeft, endRight]);
    let left = head, right = head;
    const spans = [];
    for (const [nextLeft, nextRight] of matches) {
        if (left !== nextLeft || right !== nextRight) spans.push({ left, right, removed: nextLeft - left, added: nextRight - right });
        left = nextLeft + 1; right = nextRight + 1;
    }
    return spans;
}
