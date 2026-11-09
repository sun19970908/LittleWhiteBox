import viewCss from './view.css?inline';
import { COPY } from './copy.js';
import { observeBackgroundTask } from '../../../shared/common/async-errors.js';
import { renderUpdateResult } from './result-view.js';

const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
};

export function createUpdaterView(api) {
    const style = element('style', viewCss); document.head.append(style);
    const dialog = element('dialog', null, 'xb-variable-settings');
    const header = element('header'), title = element('h2', COPY.title), nav = element('nav'), main = element('main'), footer = element('footer');
    const notice = element('output'); notice.setAttribute('role', 'status');
    let settings = api.settings(), page = 'update';
    const button = (text, action, primary = false) => {
        const node = element('button', text, primary ? 'xb-variable-primary' : ''); node.type = 'button';
        node.addEventListener('click', () => observeBackgroundTask(act(action, node), { source: import.meta.url, operation: 'action' })); return node;
    };
    async function act(action, node) {
        node.disabled = true;
        notice.textContent = ''; notice.dataset.error = 'false';
        try { await action(); }
        catch (error) {
            notice.textContent = error.message; notice.dataset.error = 'true';
            if (!dialog.open) globalThis.toastr?.error(error.message, COPY.title);
        }
        finally { node.disabled = false; }
    }
    header.append(title, button(COPY.close, () => dialog.close())); footer.append(notice);
    dialog.append(header, nav, main, footer); document.body.append(dialog);
    const field = (label, control) => { const node = element('label', label); node.append(control); return node; };
    const select = (items, value, change) => {
        const node = element('select');
        for (const [key, text] of Object.entries(items)) { const option = element('option', text); option.value = key; node.append(option); }
        node.value = value; node.addEventListener('change', () => change(node.value)); return node;
    };
    const row = (...nodes) => { const node = element('div', null, 'xb-variable-row'); node.append(...nodes); return node; };
    function renderUpdate() {
        const controls = row(field(COPY.mode, select(COPY.modes, settings.mode, value => { settings.mode = value; })),
            field(COPY.source, select(COPY.sources, settings.source, value => { settings.source = value; })));
        const help = element('section', null, 'xb-variable-help');
        help.append(element('h3', COPY.help.title));
        for (const [label, text] of COPY.help.steps) {
            const paragraph = element('p'); paragraph.append(element('strong', `${label}：`), text); help.append(paragraph);
        }
        const preview = element('details'), content = element('pre'); preview.append(element('summary', COPY.preview), content);
        const actions = row(button(COPY.save, () => { api.saveSettings(settings); notice.textContent = COPY.saved; }, true),
            button(COPY.preview, async () => { content.textContent = JSON.stringify(await api.preview(), null, 2); preview.hidden = false; preview.open = true; }));
        preview.hidden = true;
        main.append(controls, actions, help, preview);
    }
    function render() {
        main.replaceChildren(); nav.replaceChildren();
        for (const [key, label] of [['update', COPY.title], ['result', COPY.details]]) {
            const tab = button(label, () => { page = key; render(); }); tab.dataset.selected = String(page === key); nav.append(tab);
        }
        nav.append(button(COPY.assistant, async () => { await api.openAssistant(); dialog.close(); }));
        try {
            if (page === 'update') renderUpdate();
            else renderUpdateResult(api.result(), main);
        } catch (error) { main.append(element('p', error.message)); }
    }
    function open(nextPage = 'update') {
        if (nextPage === 'card') { observeBackgroundTask(api.openAssistant(), { source: import.meta.url, operation: 'openCardWorkspace' }); return; }
        page = nextPage; render(); if (!dialog.open) dialog.showModal();
    }
    function refresh() { if (dialog.open && page === 'result') render(); }
    function mountControls(target, status, mode) {
        document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove());
        const message = document.querySelector(`.mes[mesid="${target.floor}"] .mes_text`);
        if (!message || mode === 'off') return;
        const controls = element('div', null, 'xb-variable-controls');
        const label = element('span', COPY.phases[status.phase]); label.setAttribute('role', 'status');
        controls.append(button(status.busy ? COPY.cancel : status.saveFailed ? COPY.saveChat : ['success', 'recorded'].includes(status.phase) ? COPY.retry : COPY.update,
            status.busy ? api.cancel : status.saveFailed ? api.retrySave : api.update), label,
        button(COPY.details, () => open('result')));
        if (status.phase === 'saving') controls.querySelector('button').disabled = true;
        message.after(controls);
    }
    return { open, refresh, mountControls, dispose() { dialog.remove(); style.remove(); document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove()); } };
}
