import { LOG_BUDGET_CHARS, LOG_LIMIT } from './contract';

export interface Diagnostic {
    id: number;
    frameId: string;
    documentId: string;
    time: string;
    kind: string;
    detail: string;
    omittedChars: number;
}

// Only strings live here: no Error, DOM node, or console argument is retained.
export class DiagnosticBuffer {
    private records: Diagnostic[] = [];
    private chars = 0;
    private sequence = 0;
    private evicted = 0;

    add(frameId: string, documentId: string, kind: string, detail: string) {
        const entry: Diagnostic = {
            id: ++this.sequence, frameId, documentId, kind, time: new Date().toISOString(),
            detail: detail.slice(0, LOG_BUDGET_CHARS), omittedChars: Math.max(0, detail.length - LOG_BUDGET_CHARS),
        };
        while (this.records.length && (this.chars + entry.detail.length > LOG_BUDGET_CHARS || this.records.length >= LOG_LIMIT)) {
            this.chars -= this.records.shift()!.detail.length;
            this.evicted++;
        }
        this.records.push(entry);
        this.chars += entry.detail.length;
    }

    remove(frameId: string) {
        this.records = this.records.filter(record => record.frameId !== frameId);
        this.chars = this.records.reduce((sum, record) => sum + record.detail.length, 0);
    }

    read(frameId: string) {
        return {
            records: this.records.filter(record => record.frameId === frameId),
            retention: { chars: this.chars, maxChars: LOG_BUDGET_CHARS, maxEntries: LOG_LIMIT, evicted: this.evicted },
        };
    }

    clear() { this.records = []; this.chars = 0; this.evicted = 0; }
}

// Console inspection must not invoke user getters/toJSON or keep a huge object alive.
export function diagnosticText(value: unknown, ErrorType: ErrorConstructor = Error): string {
    const seen = new WeakSet<object>();
    let remaining = LOG_BUDGET_CHARS + 1;
    const take = (text: string) => {
        const result = text.slice(0, Math.max(0, remaining));
        remaining -= result.length;
        return result;
    };
    function visit(item: unknown, depth: number): string {
        if (remaining <= 0) {return '';}
        if (typeof item === 'string') {return take(item);}
        if (item === null || typeof item !== 'object') {return take(String(item));}
        if (seen.has(item)) {return take('[Circular]');}
        if (depth > 12) {return take('[Depth limit]');}
        seen.add(item);
        // Error.stack is a native lazy accessor in V8, not an ordinary enumerable field.
        if (item instanceof ErrorType) {
            return take(item.stack || item.name + ': ' + item.message);
        }
        const parts: string[] = [take('{')];
        for (const key of Reflect.ownKeys(item)) {
            if (remaining <= 0) {break;}
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            parts.push(take(String(key) + ': '), descriptor && 'value' in descriptor
                ? visit(descriptor.value, depth + 1) : take('[Accessor]'), take(', '));
        }
        parts.push(take('}'));
        return parts.join('');
    }
    try {
        const result = visit(value, 0);
        return remaining <= 0 ? result + '\n[Memory limit: remaining data omitted]' : result;
    } catch (error) {
        return '[Uninspectable console value: ' + String(error) + ']';
    }
}

export function captureDocument(win: Window, record: (kind: string, detail: string) => void): () => void {
    const ErrorType = (win as Window & { Error?: ErrorConstructor }).Error || Error;
    const controller = new AbortController();
    const onError = (event: Event) => {
        if (event.target && event.target !== win) {
            const target = event.target as Element;
            record('resource', JSON.stringify({
                tag: target.localName,
                url: target.getAttribute?.('src') || target.getAttribute?.('href'),
                html: target.outerHTML,
            }));
            return;
        }
        const error = event as ErrorEvent;
        record('error', diagnosticText({
            message: error.message, source: error.filename, line: error.lineno, column: error.colno,
            error: error.error,
        }, ErrorType));
    };
    const onRejection = (event: PromiseRejectionEvent) => record('unhandledrejection', diagnosticText(event.reason, ErrorType));
    // Capture observes failed resources before their non-bubbling error is lost.
    win.addEventListener('error', onError, { capture: true, signal: controller.signal });
    win.addEventListener('unhandledrejection', onRejection, { signal: controller.signal });
    const consoleObject = (win as Window & { console: Console }).console;
    const originals = { error: consoleObject.error, warn: consoleObject.warn };
    const wrappers = {} as typeof originals;
    for (const level of ['error', 'warn'] as const) {
        wrappers[level] = function (...args: unknown[]) {
            record('console.' + level, diagnosticText({ arguments: args, stack: new ErrorType().stack }, ErrorType));
            return Reflect.apply(originals[level], consoleObject, args);
        };
        consoleObject[level] = wrappers[level];
    }
    return () => {
        // WindowProxy may already target a cross-origin document. Abort the old
        // listeners without accessing that window again.
        controller.abort();
        for (const level of ['error', 'warn'] as const) {
            if (consoleObject[level] === wrappers[level]) {consoleObject[level] = originals[level];}
        }
    };
}
