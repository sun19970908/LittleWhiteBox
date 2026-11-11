import type { Json, Path, Change } from '../types.js';
import { reject } from './diagnostics.js';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export const clone = <T>(value: T): T => structuredClone(value);
export function equal(a: unknown, b: unknown): boolean {
    if (a === b) {return true;}
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {return false;}
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
export const contains = (parent: Path, child: Path) => parent.length <= child.length && parent.every((part, index) => part === child[index]);
export const overlaps = (a: Path, b: Path) => contains(a, b) || contains(b, a);

export function pathOf(value: unknown): Path {
    if (!Array.isArray(value) || !value.length || value.some(part => typeof part !== 'string' || forbidden.has(part))) {reject('path', { path: value });}
    return value;
}
export function assertJson(value: unknown): asserts value is Json {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {return;}
    if (typeof value === 'number' && Number.isFinite(value)) {return;}
    if (Array.isArray(value)) { value.forEach(assertJson); return; }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        for (const [key, item] of Object.entries(value)) {
            if (forbidden.has(key)) {reject('path', { path: [key] });}
            assertJson(item);
        }
        return;
    }
    reject('json');
}
export function getAt(state: Json | undefined, path: Path): Json | undefined {
    let value = state;
    for (const part of path) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {return undefined;}
        value = (value as Record<string, Json>)[part];
    }
    return value;
}
export function setAt(state: Json, path: Path, value: Json | undefined, remove = false) {
    pathOf(path);
    let parent = state;
    for (const part of path.slice(0, -1)) {
        if (parent === null || typeof parent !== 'object' || !Object.hasOwn(parent, part)) {reject('missing-parent', { path });}
        parent = (parent as Record<string, Json>)[part];
    }
    if (parent === null || typeof parent !== 'object') {reject('missing-parent', { path });}
    const key = path[path.length - 1];
    if (Array.isArray(parent)) {
        if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > parent.length) {reject('array-index', { path });}
        if (remove) {parent.splice(Number(key), 1);}
        else { assertJson(value); parent[Number(key)] = clone(value); }
    } else if (remove) {delete parent[key];}
    else { assertJson(value); parent[key] = clone(value); }
}

// Structural leaves include removed/new descendants, so parent replacement cannot
// conceal a restricted child. Arrays are traversed by actual indices as well.
export function changes(before: Json | undefined, after: Json | undefined, path: Path = []): Change[] {
    if (equal(before, after)) {return [];}
    const object = (value: Json | undefined): value is Record<string, Json> => value !== null && typeof value === 'object';
    if (object(before) || object(after)) {
        const keys = new Set([...Object.keys(object(before) ? before : {}), ...Object.keys(object(after) ? after : {})]);
        const result = [...keys].flatMap(key => changes(object(before) ? before[key] : undefined, object(after) ? after[key] : undefined, [...path, key]));
        if (result.length) {return result;}
    }
    return [{ path, ...(before === undefined ? {} : { before: clone(before) }), ...(after === undefined ? {} : { after: clone(after) }), removed: after === undefined }];
}
