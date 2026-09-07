export interface FifoCoordinator<T> {
    readonly size: number;
    enqueue: (value: T) => void;
    peek: () => T | undefined;
    shift: () => T | undefined;
    removeWhere: (predicate: (value: T) => boolean) => T[];
    forEach: (visit: (value: T) => void) => void;
    drain: () => T[];
}

export function createFifoCoordinator<T>(): FifoCoordinator<T> {
    const values: T[] = [];
    return {
        get size() {return values.length;},
        enqueue(value) {values.push(value);},
        peek() {return values[0];},
        shift() {return values.shift();},
        removeWhere(predicate) {
            const removed: T[] = [];
            for (let index = values.length - 1; index >= 0; index -= 1) {
                if (predicate(values[index])) {removed.unshift(...values.splice(index, 1));}
            }
            return removed;
        },
        forEach(visit) {values.forEach(visit);},
        drain() {return values.splice(0, values.length);},
    };
}
