import { COPY } from './copy.js';

const valueText = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export function renderUpdateResult(value, root) {
    root.replaceChildren();
    const add = (parent, tag, text, className) => {
        const node = document.createElement(tag);
        node.textContent = text;
        if (className) node.className = className;
        parent.append(node); return node;
    };
    const annotations = (parent, items) => {
        if (!items.length) return;
        const section = add(parent, 'details', '', 'xb-variable-annotations');
        section.open = true;
        add(section, 'summary', COPY.result.annotations);
        const list = add(section, 'dl', '');
        for (const [name, content] of items) { add(list, 'dt', name); add(list, 'dd', valueText(content)); }
    };
    if (value.error) add(root, 'p', value.error, 'xb-variable-error');
    for (const batch of value.batches) {
        for (const operation of batch.operations) {
            const section = add(root, 'section', '', 'xb-variable-change');
            if (!operation.changes.length) add(section, 'p', `${operation.path} · ${COPY.result.unchanged}`);
            for (const change of operation.changes) {
                const line = add(section, 'p', '', `xb-variable-change-${change.kind}`);
                add(line, 'strong', change.path);
                const text = change.kind === 'changed' ? `：${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`
                    : ` · ${COPY.result[change.kind]}\n${change.kind === 'added' ? '＋' : '－'} ${valueText(change.kind === 'added' ? change.after : change.before)}`;
                add(line, 'span', text);
            }
            annotations(section, operation.annotations);
        }
        annotations(root, batch.annotations);
        for (const error of batch.errors) add(root, 'p', error.message, 'xb-variable-error');
        for (const correction of batch.corrections) {
            const section = add(root, 'details', '');
            add(section, 'summary', `${correction.path} · ${COPY.result.corrected}`);
            add(section, 'pre', `${COPY.result.requested}：${valueText(correction.requested)}\n${COPY.result.applied}：${valueText(correction.value)}${correction.note ? '\n' + correction.note : ''}`);
        }
    }
    if (!root.childNodes.length) add(root, 'p', value.phase === 'recorded' ? COPY.result.unchanged : COPY.phases[value.phase] || COPY.phases.noop);
}
