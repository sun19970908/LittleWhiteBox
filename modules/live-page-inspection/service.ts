import { ACTIONS, COLLECTOR_KEY, COPY, InspectionError, PAGE_CHARS, type InspectArgs } from './contract';
import { brief, computed, findElements, hiddenReasons, inspectElement, inspectStyles, rect, hitTest } from './dom';
import { captureDocument, DiagnosticBuffer } from './recorder';

interface PageDocument {
    doc: Document;
    id: string;
    coverage: 'before-scripts' | 'from-inspection';
    startedAt: string;
    revision: number;
    observer: MutationObserver;
    cleanup: () => void;
    elementIds: WeakMap<Element, string>;
    elements: Map<string, WeakRef<Element>>;
    sequence: number;
}
interface Frame {
    id: string;
    iframe: HTMLIFrameElement;
    page?: PageDocument;
}

function documentOf(iframe: HTMLIFrameElement): Document | null {
    try { return iframe.contentDocument; } catch { return null; } // Browser cross-origin boundary.
}

function floorOf(iframe: HTMLIFrameElement): string | null {
    let current: Element | null = iframe;
    while (current) {
        const floor = current.closest('.mes[mesid]');
        if (floor) {return floor.getAttribute('mesid');}
        try { current = current.ownerDocument.defaultView?.frameElement || null; } catch { return null; }
    }
    return null;
}

function isLiveFrame(iframe: HTMLIFrameElement, host: Window): boolean {
    let current: Element | null = iframe;
    while (current) {
        if (!current.isConnected) { return false; }
        if (current.ownerDocument === host.document) { return floorOf(iframe) !== null; }
        try { current = current.ownerDocument.defaultView?.frameElement || null; } catch { return false; }
    }
    return false;
}

export function createLivePageInspection(host: Window) {
    const instance = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    const frames = new Map<string, Frame>();
    const ids = new WeakMap<HTMLIFrameElement, string>();
    const logs = new DiagnosticBuffer();
    let sequence = 0, documentSequence = 0;
    let disposed = false;

    function drop(frame: Frame) {
        frame.page?.cleanup();
        frame.page?.observer.disconnect();
        frames.delete(frame.id);
        logs.remove(frame.id);
    }

    function prune() {
        for (const frame of frames.values()) {
            if (!isLiveFrame(frame.iframe, host)) {drop(frame);}
        }
    }

    function track(iframe: HTMLIFrameElement): Frame {
        let id = ids.get(iframe);
        if (!id) { id = instance + '-frame-' + (++sequence); ids.set(iframe, id); }
        let frame = frames.get(id);
        if (!frame) { frame = { id, iframe }; frames.set(id, frame); }
        return frame;
    }

    function attach(frame: Frame, beforeScripts = false) {
        const doc = documentOf(frame.iframe);
        if (frame.page?.doc === doc) {return;}
        if (frame.page) {
            frame.page.cleanup();
            frame.page.observer.disconnect();
            frame.page = undefined;
            logs.remove(frame.id);
        }
        if (!doc?.defaultView) {return;}
        const win = doc.defaultView;
        const id = instance + '-document-' + (++documentSequence);
        const page: PageDocument = {
            doc, id, coverage: beforeScripts ? 'before-scripts' : 'from-inspection', startedAt: new Date().toISOString(),
            revision: 0, observer: new MutationObserver(() => { page.revision++; }),
            cleanup: () => {}, elementIds: new WeakMap(), elements: new Map(), sequence: 0,
        };
        page.observer.observe(doc, { childList: true, subtree: true, attributes: true, characterData: true });
        const stopCapture = captureDocument(win, (kind, detail) => {
            if (!disposed && isLiveFrame(frame.iframe, host) && frame.page === page) {logs.add(frame.id, page.id, kind, detail);}
        });
        doc.addEventListener('load', onLoad, true);
        page.cleanup = () => { stopCapture(); doc.removeEventListener('load', onLoad, true); };
        frame.page = page;
    }

    function onLoad(event: Event) {
        const target = event.target as Element | null;
        if (target?.localName !== 'iframe') {return;}
        const iframe = target as HTMLIFrameElement;
        if (isLiveFrame(iframe, host)) {attach(track(iframe));}
    }

    function collect(): Frame[] {
        prune();
        const result: Frame[] = [];
        const visit = (iframe: HTMLIFrameElement) => {
            const frame = track(iframe);
            attach(frame);
            result.push(frame);
            frame.page?.doc.querySelectorAll<HTMLIFrameElement>('iframe').forEach(visit);
        };
        host.document.querySelectorAll<HTMLIFrameElement>('.mes[mesid] iframe').forEach(visit);
        return result;
    }

    const collector = (win: Window) => {
        const iframe = win.frameElement as HTMLIFrameElement | null;
        if (iframe && isLiveFrame(iframe, host)) {attach(track(iframe), true);}
    };
    const surface = host as unknown as Record<string, unknown>;
    surface[COLLECTOR_KEY] = collector;
    const removalObserver = new MutationObserver(records => {
        if (records.some(record => record.removedNodes.length)) {prune();}
    });
    removalObserver.observe(host.document, { childList: true, subtree: true });
    host.document.addEventListener('load', onLoad, true);
    collect();

    function identify(page: PageDocument, element: Element) {
        let id = page.elementIds.get(element);
        if (!id) {
            id = page.id + '-element-' + (++page.sequence);
            page.elementIds.set(element, id);
            page.elements.set(id, new WeakRef(element));
        }
        return id;
    }

    function frameInfo(frame: Frame) {
        const page = frame.page;
        return {
            frameId: frame.id, floor: floorOf(frame.iframe), iframeId: frame.iframe.id,
            url: page?.doc.URL || frame.iframe.src, title: page?.doc.title,
            accessible: !!page, documentId: page?.id, readyState: page?.doc.readyState,
            capture: page ? { coverage: page.coverage, startedAt: page.startedAt } : null,
            rect: rect(frame.iframe), hiddenReasons: hiddenReasons(frame.iframe),
            style: computed(frame.iframe, ['display', 'visibility', 'opacity', 'pointer-events']),
            hostHitTest: hitTest(frame.iframe, () => ''),
            errorCount: logs.read(frame.id).records.length,
        };
    }

    function pickElement(frame: Frame, args: InspectArgs): Element {
        const page = frame.page!;
        if (args.elementId) {
            const element = page.elements.get(args.elementId)?.deref();
            if (!element?.isConnected || element.ownerDocument !== page.doc) {throw new InspectionError('stale_element');}
            return element;
        }
        if (args.text || args.selector) {
            const found = findElements(page.doc, args.text, args.selector, args.includeHidden ?? !!args.selector);
            if (!found.length) {throw new InspectionError('not_found');}
            if (found.length > 1) {throw new InspectionError('ambiguous');}
            return found[0];
        }
        return page.doc.body || page.doc.documentElement;
    }

    function execute(args: InspectArgs = {}) {
        try {
            const action = args.action || 'inspect';
            if (!ACTIONS.includes(action) || (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || args.offset < 0))) {
                throw new InspectionError('invalid_args');
            }
            const live = collect();
            let frame: Frame | undefined;
            let result: unknown;
            if (action === 'list') {
                result = { frames: live.map(frameInfo) };
            } else {
                // Last iframe in the highest numbered live floor, not the last iframe in the app.
                frame = args.frameId ? live.find(item => item.id === args.frameId)
                    : live.reduce<Frame | undefined>((latest, item) => !latest || Number(floorOf(item.iframe)) >= Number(floorOf(latest.iframe)) ? item : latest, undefined);
                if (!frame) {throw new InspectionError(args.frameId ? 'stale_frame' : 'no_frame');}
                const page = frame.page;
                if (args.documentId && args.documentId !== page?.id) {throw new InspectionError('stale_document');}
                if (!page) {return { ok: false, error: 'inaccessible', message: COPY.errors.inaccessible, frame: frameInfo(frame) };}
                if (page.observer.takeRecords().length) {page.revision++;}
                for (const [id, ref] of page.elements) {if (!ref.deref()?.isConnected) {page.elements.delete(id);}}
                const identifyElement = (element: Element) => identify(page, element);
                switch (action) {
                    case 'errors':
                        result = logs.read(frame.id);
                        break;
                    case 'find':
                        result = { elements: findElements(page.doc, args.text, args.selector, args.includeHidden)
                            .map(element => ({ ...brief(element, identifyElement), rect: rect(element), hiddenReasons: hiddenReasons(element) })) };
                        break;
                    case 'dom':
                        result = pickElement(frame, args).outerHTML;
                        break;
                    case 'styles':
                        result = inspectStyles(pickElement(frame, args), args.properties, args.pseudo);
                        break;
                    case 'inspect':
                        result = inspectElement(pickElement(frame, args), identifyElement);
                        break;
                }
            }
            const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            const offset = args.offset || 0;
            let end = Math.min(content.length, offset + PAGE_CHARS);
            if (end < content.length && /[\uD800-\uDBFF]/u.test(content[end - 1])) {end--;}
            const next = end < content.length
                ? { ...args, action, frameId: frame?.id, documentId: frame?.page?.id, offset: end } : null;
            return {
                ok: true, action, frame: frame ? frameInfo(frame) : undefined,
                content: content.slice(offset, end), format: action === 'dom' ? 'html' : 'json',
                offset, nextOffset: next ? end : null, totalChars: content.length, next,
                revision: frame?.page?.revision, readAt: new Date().toISOString(),
            };
        } catch (error) {
            return { ok: false, error: error instanceof InspectionError ? error.code : 'inspection_failed', message: String(error instanceof Error ? error.message : error) };
        }
    }

    return {
        execute,
        clear() { for (const frame of frames.values()) {drop(frame);} logs.clear(); },
        dispose() {
            disposed = true;
            this.clear();
            removalObserver.disconnect();
            host.document.removeEventListener('load', onLoad, true);
            if (surface[COLLECTOR_KEY] === collector) {delete surface[COLLECTOR_KEY];}
        },
    };
}

let inspection: ReturnType<typeof createLivePageInspection> | undefined;
export function startLivePageInspection() {
    inspection ??= createLivePageInspection(window);
    return inspection;
}
export function runLivePageInspection(args: InspectArgs) { return startLivePageInspection().execute(args); }
export function clearLivePageInspection() { inspection?.clear(); }
export function stopLivePageInspection() { inspection?.dispose(); inspection = undefined; }
