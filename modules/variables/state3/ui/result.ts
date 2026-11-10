import type { Result, Definition, Diagnostic, Source, Change } from '../types.js';
import type { ErrorObject } from 'ajv';
import { COPY, errorText, parameterIssueText, restorationLabel, restorationText } from './copy.js';
import { overlaps } from '../engine/data.js';
import { parameterIssues } from '../definition/schema-fields.js';

export const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (text !== undefined) {node.textContent = text;}
    if (className) {node.className = className;}
    return node;
};
export function resultLabel(result: Result): string {
    if (!result.ok) {return COPY.failed;}
    if (!result.committed) {return COPY.previewLabel;}
    if (!result.saved) {return COPY.phases.unsaved;}
    return result.restoration ? `${restorationLabel(result)} · ${COPY.saved}` : COPY.saved;
}
export function showDiagnostics(root: HTMLElement, diagnostics: Diagnostic[], definition?: Definition) {
    for (const error of diagnostics) {
        const rule = [...(definition?.rules || []), ...(definition?.constraints || []), ...(definition?.triggers || [])].find(item => item.id === error.rule);
        root.append(element('p', [errorText(error), !error.condition && !error.parameters ? rule?.description : undefined].filter(Boolean).join(' ')));
        if (Array.isArray(error.errors) && !error.parameters) {
            const fields = parameterIssues(error.code === 'state-schema' && definition ? definition.schema : {}, error.errors as ErrorObject[]);
            for (const field of fields) {root.append(element('p', parameterIssueText(field)));}
        }
        if (error.errors || error.response) {
            const details = element('details'); details.append(element('summary', COPY.details));
            if (error.errors) {details.append(element('pre', JSON.stringify(error.errors, null, 2)));}
            if (typeof error.response === 'string') {details.append(element('pre', error.response));}
            root.append(details);
        }
    }
}
/** Rule check: whether the draft works, and the opening state it produces. */
export function showCheck(root: HTMLElement, result: Result) {
    root.replaceChildren();
    if (!result.ok) { root.append(element('p', COPY.checkFailed, 'lwb-state3-status')); showDiagnostics(root, result.diagnostics); return; }
    root.append(element('p', COPY.checkPassed, 'lwb-state3-status'), element('pre', JSON.stringify(result.state, null, 2)));
}
export function showResult(root: HTMLElement, result: Result, definition?: Definition) {
    root.replaceChildren();
    if (!result.ok) {
        root.append(element('p', COPY.failed));
        showDiagnostics(root, result.diagnostics || [], definition);
        return;
    }
    const restorationWarning = Boolean(result.restoration?.length);
    if (!result.committed) {
        if (result.changes.length) {root.append(element('p', COPY.previewed, 'lwb-state3-status'));}
    } else if (!restorationWarning || !result.saved) {
        const status = element('p', !result.saved ? COPY.unconfirmed : resultLabel(result), 'lwb-state3-status');
        status.setAttribute('role', 'status'); root.append(status);
    }
    if (result.restoration?.length) {
        const warning = element('div'); warning.setAttribute('role', 'alert');
        for (const issue of result.restoration) {
            warning.append(element('p', restorationText(issue)));
        }
        if (result.restoration.some(issue => ['constraint', 'state-schema'].includes(issue.code))) {warning.append(element('p', COPY.conflictHelp));}
        root.append(warning);
    }
    for (const error of result.diagnostics) {root.append(element('p', errorText(error)));}
    const shown = result.changes;
    const shownReasons = new Set<number>();
    const sourceInfo = (source?: Source) => {
        const rule = source?.kind === 'action' ? definition?.actions.find(item => item.id === source.id)
            : source?.kind === 'trigger' ? definition?.triggers?.find(item => item.id === source.id)
                : definition?.rules.find(item => item.id === source?.id);
        const title = source?.title || (rule && 'title' in rule ? rule.title : undefined);
        // An action's description is its instruction to the update model, not a player-facing explanation.
        return { label: title || (source ? COPY.reasons[source.kind] : COPY.restoredChanges),
            description: source?.kind === 'action' ? undefined : source?.description || rule?.description, tag: title || [source && COPY.reasons[source.kind], source?.id].filter(Boolean).join(' · ') };
    };
    const sourceKey = (source?: Source) => JSON.stringify([source?.kind, source?.id]);
    const groups = new Map<string, { source?: Source; changes: { change: Change; sources: Source[] }[] }>();
    for (const change of shown) {
        const sources = [...new Map(result.provenance.filter(item => overlaps(item.path, change.path))
            .map(item => [sourceKey(item.source), item.source])).values()];
        const source = sources[0], key = sourceKey(source);
        if (!groups.has(key)) {groups.set(key, { source, changes: [] });}
        groups.get(key)!.changes.push({ change, sources });
    }
    for (const group of groups.values()) {
        const section = element('details', undefined, 'lwb-state3-change-group'), info = sourceInfo(group.source);
        section.open = !group.source || ['input', 'action'].includes(group.source.kind);
        section.append(element('summary', COPY.sourceGroup(info.label, group.changes.length)));
        if (info.description) {section.append(element('p', info.description, 'lwb-state3-source-description'));}
        for (const { change, sources } of group.changes) {
            const line = element('div', undefined, 'lwb-state3-change');
            line.append(element('strong', change.path.join(' → ')),
                element('div', change.before === undefined ? `${COPY.added} ＋ ${JSON.stringify(change.after)}` : change.removed ? `${COPY.removed} － ${JSON.stringify(change.before)}` : `${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`));
            if (sources.length > 1) {line.append(element('small', sources.slice(1).map(source => sourceInfo(source).tag).join(' / ')));}
            for (const note of result.annotations || []) {
                if (!(note.path && overlaps(note.path, change.path)) && !(note.action && sources.some(source => source.id === note.action))) {continue;}
                const reason = note.fields.find(([key]) => key === 'reason');
                if (reason) {
                    line.append(element('p', typeof reason[1] === 'string' ? reason[1] : JSON.stringify(reason[1]), 'lwb-state3-reason'));
                    shownReasons.add(note.index);
                }
            }
            section.append(line);
        }
        root.append(section);
    }
    for (const annotation of result.annotations || []) {
        const extras = annotation.fields.filter(([key]) => key !== 'reason' || !shownReasons.has(annotation.index));
        if (!extras.length) {continue;}
        const section = element('details');
        section.append(element('summary', `${COPY.annotation} · ${annotation.index + 1} · ${annotation.action || annotation.path?.join(' → ') || ''}`));
        const fields = element('dl');
        for (const [key, value] of extras) {fields.append(element('dt', key), element('dd', typeof value === 'string' ? value : JSON.stringify(value, null, 2)));}
        section.append(fields); root.append(section);
    }
    if (!shown.length) {root.append(element('p', COPY.empty));}
}
