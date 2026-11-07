import type { Json, Path } from '../types.js';
export interface FunctionOptions { id: string; source: string; input?: Json; reads?: Path[]; state: Json; beforeState?: Json; signal?: AbortSignal; timeoutMs?: number }
import { DefaultIntrinsics, newQuickJSWASMModuleFromVariant, type QuickJSHandle, type QuickJSWASMModule, type QuickJSContext } from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-singlefile-cjs-release-sync';

export const DEFAULT_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 1000;
const MEMORY_LIMIT = 16 * 1024 * 1024;
let engineReady: Promise<QuickJSWASMModule> | undefined;

export class FunctionExecutionError extends Error {
    details: Record<string, unknown>;
    path?: Path;
    constructor(public code: string, public functionId: string, details: Record<string, unknown> = {}) {
        super(code);
        this.name = 'FunctionExecutionError';
        this.code = code;
        this.details = { functionId, ...details };
        Object.assign(this, this.details);
    }
}

export function failure(code: string, id: string, details?: Record<string, unknown>) {
    return new FunctionExecutionError(code, id, details);
}

export function timeoutFor(timeoutMs: number, id: string) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
        throw failure('function_invalid_timeout', id);
    }
    return timeoutMs;
}

function isPath(path: unknown): path is Path {
    return Array.isArray(path) && path.every(segment => typeof segment === 'string');
}

function readValue(state: Json | undefined, path: Path): Json | undefined {
    let value = state;
    for (const segment of path) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) {
            return undefined;
        }
        value = (value as Record<string, Json>)[segment];
    }
    return value;
}

// This closure retains pristine JSON/inspection functions before guest code can change globals.
// Only JSON strings cross the VM boundary; no host object or host reference is exposed.
const BOOTSTRAP = `(() => {
    'use strict';
    const parse = JSON.parse, stringify = JSON.stringify;
    const keys = Object.keys, getPrototypeOf = Object.getPrototypeOf;
    const getDescriptor = Object.getOwnPropertyDescriptor;
    const arrayIsArray = Array.isArray, numberIsFinite = Number.isFinite;
    const objectPrototype = Object.prototype, arrayPrototype = Array.prototype;
    const SetCtor = Set, ErrorCtor = Error;
    Object.defineProperty(Math, 'random', { value: undefined, writable: false, configurable: false });
    function encode(value) {
        const seen = new SetCtor();
        function visit(item) {
            if (item === null || typeof item === 'string' || typeof item === 'boolean') return stringify(item);
            if (typeof item === 'number' && numberIsFinite(item)) return stringify(item);
            if (!item || typeof item !== 'object' || seen.has(item)) throw new ErrorCtor('function_invalid_result');
            const array = arrayIsArray(item);
            const prototype = getPrototypeOf(item);
            if (array ? prototype !== arrayPrototype : prototype !== objectPrototype && prototype !== null) {
                throw new ErrorCtor('function_invalid_result');
            }
            seen.add(item);
            const names = keys(item), entries = [];
            if (array && (names.length !== item.length || names.some((key, index) => key !== '' + index))) {
                throw new ErrorCtor('function_invalid_result');
            }
            for (const key of names) {
                const descriptor = getDescriptor(item, key);
                if (!descriptor || !('value' in descriptor)) throw new ErrorCtor('function_invalid_result');
                const encoded = visit(descriptor.value);
                entries.push(array ? encoded : stringify(key) + ':' + encoded);
            }
            seen.delete(item);
            return (array ? '[' : '{') + entries.join(',') + (array ? ']' : '}');
        }
        return visit(value);
    }
    return (fn, inputJson, read, readBefore) => {
        if (typeof fn !== 'function') throw new ErrorCtor('function_invalid_source');
        const get = path => {
            const result = parse(read(stringify(path)));
            return result.length ? result[0] : undefined;
        };
        const before = path => {
            const result = parse(readBefore(stringify(path)));
            return result.length ? result[0] : undefined;
        };
        return encode(fn(parse(inputJson), Object.freeze({ get, before })));
    };
})()`;

/**
 * Worker/Node entry. Guest execution is synchronous; async work only initializes WASM.
 * A fresh runtime is destroyed after every call, including exceptions and interruption.
 * Source is a function expression `(input, { get, before }) => jsonValue`.
 * Declared segment paths authorize themselves and descendants, never ancestors.
 * Missing values read as undefined; before() requires an explicit beforeState.
 * This entry cannot observe same-thread timer aborts while executing synchronous JS.
 */
export async function runFunctionInVm({ id, source, input = [], reads = [], state, beforeState, signal, timeoutMs = DEFAULT_TIMEOUT_MS }: FunctionOptions): Promise<Json> {
    const timeout = timeoutFor(timeoutMs, id);
    if (signal?.aborted) {throw failure('function_aborted', id);}
    if (typeof source !== 'string' || !Array.isArray(reads) || !reads.every(isPath)) {
        throw failure('function_invalid_source', id);
    }
    const engine = await initializeFunctionVm();
    if (signal?.aborted) {throw failure('function_aborted', id);}
    const runtime = engine.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT);
    runtime.setMaxStackSize(256 * 1024);
    let deadline = Infinity;
    let interrupted: string | undefined;
    let violation: FunctionExecutionError | undefined;
    runtime.setInterruptHandler(() => {
        if (signal?.aborted) {interrupted = 'function_aborted';}
        else if (performance.now() >= deadline) {interrupted = 'function_timeout';}
        return Boolean(interrupted);
    });
    const context = runtime.newContext({ intrinsics: { ...DefaultIntrinsics, Date: false } });
    const handles: QuickJSHandle[] = [];
    const hold = (handle: QuickJSHandle) => { handles.push(handle); return handle; };
    const unwrap = (result: ReturnType<QuickJSContext['evalCode']>) => {
        if (result.error) {
            result.error.dispose();
            throw violation || failure(interrupted || 'function_exception', id);
        }
        return hold(result.value);
    };
    const bridge = (snapshot: Json | undefined, isBefore: boolean) => hold(context.newFunction(isBefore ? 'before' : 'get', pathHandle => {
        try {
            const path = JSON.parse(context.getString(pathHandle));
            if (!isPath(path)) {throw failure('function_invalid_read', id);}
            if (!reads.some(declared => declared.length <= path.length && declared.every((segment, index) => path[index] === segment))) {
                throw failure('function_undeclared_read', id, { path });
            }
            if (isBefore && beforeState === undefined) {throw failure('function_before_unavailable', id, { path });}
            const value = readValue(snapshot, path);
            return context.newString(JSON.stringify(value === undefined ? [] : [value]));
        } catch (error) {
            violation = error instanceof FunctionExecutionError ? error : failure('function_invalid_read', id);
            return { error: context.newError(violation.code) };
        }
    }));
    try {
        const invoke = unwrap(context.evalCode(BOOTSTRAP, 'variable3-bootstrap.js'));
        // VM/bootstrap initialization is platform work, not authored execution.
        // Start the guest deadline immediately before evaluating its source.
        deadline = performance.now() + timeout;
        const fn = unwrap(context.evalCode(`(${source}\n)`, `${id || 'function'}.js`));
        const inputJson = JSON.stringify(input);
        if (inputJson === undefined) {throw failure('function_invalid_input', id);}
        const result = unwrap(context.callFunction(invoke, context.undefined, fn, hold(context.newString(inputJson)), bridge(state, false), bridge(beforeState, true)));
        if (violation) {throw violation;}
        if (signal?.aborted) {throw failure('function_aborted', id);}
        if (performance.now() >= deadline) {throw failure('function_timeout', id);}
        return JSON.parse(context.getString(result));
    } catch (error) {
        if (error instanceof FunctionExecutionError) {throw error;}
        throw failure('function_exception', id);
    } finally {
        for (let index = handles.length - 1; index >= 0; index--) {handles[index].dispose();}
        context.dispose();
        runtime.dispose();
    }
}


export function initializeFunctionVm() {
    engineReady ??= newQuickJSWASMModuleFromVariant(variant);
    return engineReady;
}
