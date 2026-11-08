import type { Result, Definition } from '../types.js';
import { COPY, errorText } from './copy.js';

export const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (text !== undefined) {node.textContent = text;}
    if (className) {node.className = className;}
    return node;
};
export function showResult(root: HTMLElement, result: Result, definition?: Definition) {
    root.replaceChildren();
    root.append(element('h3', COPY.result));
    if (!result.ok) {
        root.append(element('p', COPY.failed));
        for (const error of result.diagnostics || []) {
            const rule = [...(definition?.rules || []), ...(definition?.actions || []), ...(definition?.constraints || []), ...(definition?.triggers || [])].find(item => item.id === (error.rule || error.action));
            root.append(element('p', [errorText(error), rule?.description, Array.isArray(error.path) ? error.path.join(' → ') : undefined].filter(Boolean).join(' ')));
            if (error.errors) {root.append(element('pre', JSON.stringify(error.errors, null, 2)));}
            if (typeof error.response === 'string' && error.response) {root.append(element('pre', error.response));}
        }
        return;
    }
    root.append(element('p', result.committed ? result.saved ? `${COPY.success} · ${COPY.saved}` : COPY.unconfirmed : COPY.previewed));
    for (const error of result.diagnostics) {root.append(element('p', errorText(error)));}
    const shown = result.changes;
    for (const change of shown) {
        const line = element('div', undefined, 'lwb-state3-change');
        line.append(element('strong', change.path.join(' → ')),
            element('div', change.before === undefined ? `${COPY.added} ＋ ${JSON.stringify(change.after)}` : change.removed ? `${COPY.removed} － ${JSON.stringify(change.before)}` : `${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`));
        const origins = (result.provenance || []).filter(item => JSON.stringify(item.path) === JSON.stringify(change.path));
        for (const origin of origins) {
            const rule = [...(definition?.rules || []), ...(definition?.actions || []), ...(definition?.triggers || [])].find(item => item.id === origin.source.id);
            line.append(element('small', [COPY.reasons[origin.source.kind], rule?.description].filter(Boolean).join(' · ')));
        }
        root.append(line);
    }
    for (const annotation of result.annotations || []) {
        const section = element('details'); section.open = true;
        section.append(element('summary', `${COPY.annotation} · ${annotation.index + 1} · ${annotation.action || annotation.path?.join(' → ') || ''}`));
        const fields = element('dl');
        for (const [key, value] of annotation.fields) {fields.append(element('dt', key), element('dd', typeof value === 'string' ? value : JSON.stringify(value, null, 2)));}
        section.append(fields); root.append(section);
    }
    if (!shown.length) {root.append(element('p', COPY.empty));}
}
