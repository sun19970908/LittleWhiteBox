export type Identify = (element: Element) => string;

const LAYOUT_PROPERTIES = [
    'display', 'visibility', 'opacity', 'position', 'z-index', 'pointer-events', 'overflow',
    'overflow-x', 'overflow-y', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'box-sizing', 'grid-template-columns', 'grid-template-rows', 'gap', 'flex', 'flex-direction',
    'flex-wrap', 'align-items', 'justify-content', 'white-space', 'word-break', 'overflow-wrap',
    'font-size', 'line-height', 'padding', 'margin', 'transform', 'content-visibility',
];

export function computed(element: Element, properties?: string[], pseudo?: string) {
    const style = element.ownerDocument.defaultView!.getComputedStyle(element, pseudo || null);
    return Object.fromEntries((properties || Array.from(style)).map(name => [name, style.getPropertyValue(name)]));
}

export function rect(element: Element) {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, right: box.right, bottom: box.bottom, left: box.left };
}

export function textOf(element: Element): string {
    return (element as HTMLElement).innerText ?? element.textContent ?? '';
}

export function brief(element: Element, identify: Identify) {
    const text = textOf(element);
    return {
        elementId: identify(element), tag: element.localName, id: element.id,
        class: element.getAttribute('class'), textPreview: text.slice(0, 200), textChars: text.length,
    };
}

export function hiddenReasons(element: Element) {
    const reasons: { tag: string; id: string; property: string; value: string }[] = [];
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = ancestor.ownerDocument.defaultView!.getComputedStyle(ancestor);
        for (const [property, value] of [['display', 'none'], ['visibility', 'hidden'], ['visibility', 'collapse'], ['opacity', '0'], ['content-visibility', 'hidden']]) {
            // Visibility is inherited but a child can explicitly become visible again.
            if (property === 'visibility' && ancestor !== element) { continue; }
            if (style.getPropertyValue(property) === value) {reasons.push({ tag: ancestor.localName, id: ancestor.id, property, value });}
        }
    }
    if (!element.getClientRects().length) {reasons.push({ tag: element.localName, id: element.id, property: 'layout', value: 'no client rects' });}
    return reasons;
}

export function findElements(doc: Document, text?: string, selector?: string, includeHidden = false): Element[] {
    const normalize = (value: string) => value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
    const needle = text ? normalize(text) : '';
    const elements = Array.from(doc.querySelectorAll(selector || 'body *'));
    const matched = elements.filter(element => {
        if (needle) {
            const values = [textOf(element), element.getAttribute('aria-label') || '', element.getAttribute('alt') || '', element.getAttribute('title') || ''];
            if (!values.some(value => normalize(value).includes(needle))) {return false;}
        }
        return includeHidden || hiddenReasons(element).length === 0;
    });
    if (!needle) {return matched;}
    const ancestors = new Set<Element>();
    for (const element of matched) {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {ancestors.add(parent);}
    }
    return matched.filter(element => !ancestors.has(element));
}

export function hitTest(element: Element, identify: Identify) {
    const doc = element.ownerDocument, win = doc.defaultView!;
    const box = element.getBoundingClientRect();
    const left = Math.max(0, box.left), right = Math.min(win.innerWidth, box.right);
    const top = Math.max(0, box.top), bottom = Math.min(win.innerHeight, box.bottom);
    if (right <= left || bottom <= top) {return { inViewport: false, samples: [] };}
    const samples = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([x, y]) => {
        const point = { x: left + (right - left) * x, y: top + (bottom - top) * y };
        const hit = doc.elementFromPoint(point.x, point.y);
        const ancestors = [];
        for (let parent = hit?.parentElement; parent; parent = parent.parentElement) {
            ancestors.push({ tag: parent.localName, id: parent.id, class: parent.getAttribute('class'), role: parent.getAttribute('role') });
        }
        return { ...point, reachesElement: !!hit && (hit === element || element.contains(hit)), topElement: hit ? {
            ...brief(hit, identify), src: hit.localName === 'iframe' ? hit.getAttribute('src') : undefined, ancestors,
        } : null };
    });
    return { inViewport: true, samples };
}

export function inspectElement(element: Element, identify: Identify) {
    const ancestors = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        ancestors.push({
            ...brief(parent, identify), rect: rect(parent), style: computed(parent, LAYOUT_PROPERTIES),
            disabled: parent.matches(':disabled'), ariaDisabled: parent.getAttribute('aria-disabled'), inert: parent.hasAttribute('inert'),
        });
    }
    const form = element as HTMLInputElement;
    return {
        ...brief(element, identify),
        attributes: Object.fromEntries(Array.from(element.attributes, attr => [attr.name, attr.value])),
        rect: rect(element),
        size: { clientWidth: element.clientWidth, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight },
        style: computed(element, LAYOUT_PROPERTIES),
        hiddenReasons: hiddenReasons(element), disabled: element.matches(':disabled'),
        ariaDisabled: element.getAttribute('aria-disabled'), inert: !!element.closest('[inert]'),
        value: form.type === 'password' ? '[password]' : form.value,
        checked: form.checked, hitTest: hitTest(element, identify), ancestors,
    };
}

export function inspectStyles(element: Element, properties?: string[], pseudo?: string) {
    const sheets: { href: string | null; rules?: string[]; unavailable?: string }[] = [];
    // Full rule text retains media/container conditions and pseudo selectors; no guessed cascade.
    for (const sheet of element.ownerDocument.styleSheets) {
        try {
            sheets.push({ href: sheet.href, rules: Array.from(sheet.cssRules, rule => rule.cssText) });
        } catch (error) {
            sheets.push({ href: sheet.href, unavailable: String(error) });
        }
    }
    return { computed: computed(element, properties, pseudo), inline: element.getAttribute('style'), stylesheets: sheets };
}
