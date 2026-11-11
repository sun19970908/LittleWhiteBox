import viewCss from './view.css?inline';
import controlsCss from '../shared/update-controls.css?inline';
import { COPY } from './copy.js';
import { observeBackgroundTask } from '../../../shared/common/async-errors.js';
import { renderUpdateResult } from './result-view.js';

const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
};

function createDialog(heading) {
    const dialog = element('dialog', null, 'xb-variable-settings');
    const header = element('header'), main = element('main'), footer = element('footer'), notice = element('output');
    const close = element('button', COPY.close); close.type = 'button'; close.addEventListener('click', () => dialog.close());
    notice.setAttribute('role', 'status');
    header.append(element('h2', heading), close); footer.append(notice);
    dialog.append(header, main, footer); document.body.append(dialog);
    return { dialog, main, notice };
}

export function createUpdaterView(api) {
    const style = element('style', viewCss + controlsCss); document.head.append(style);
    const settingsView = createDialog(COPY.title), resultView = createDialog(COPY.resultTitle);
    // Dialog buttons report inside their dialog; floor buttons have no dialog and use a toast.
    const button = (text, action, notice) => {
        const node = element('button', text); node.type = 'button';
        node.addEventListener('click', () => observeBackgroundTask(act(action, node, notice), { source: import.meta.url, operation: 'action' })); return node;
    };
    async function act(action, node, notice) {
        node.disabled = true;
        if (notice) { notice.textContent = ''; notice.dataset.error = 'false'; }
        try { await action(); }
        catch (error) {
            if (notice) { notice.textContent = error.message; notice.dataset.error = 'true'; }
            else globalThis.toastr?.error(error.message, COPY.title);
        }
        finally { node.disabled = false; }
    }
    const paragraphs = (root, items) => {
        for (const [label, text] of items) { const paragraph = element('p'); paragraph.append(element('strong', `${label}：`), text); root.append(paragraph); }
    };
    function renderSettings() {
        const { main } = settingsView, settings = api.settings();
        main.replaceChildren();
        const save = () => api.saveSettings(settings);
        const auto = element('input'); auto.type = 'checkbox'; auto.checked = settings.auto;
        auto.addEventListener('change', () => { settings.auto = auto.checked; save(); });
        const autoLabel = element('label', null, 'xb-variable-check'); autoLabel.append(auto, COPY.auto);
        const source = element('select');
        for (const [key, text] of Object.entries(COPY.sources)) { const option = element('option', text); option.value = key; source.append(option); }
        source.value = settings.source; source.addEventListener('change', () => { settings.source = source.value; save(); });
        const sourceLabel = element('label', COPY.source); sourceLabel.append(source);
        const help = element('section', null, 'xb-variable-help');
        paragraphs(help, COPY.help);
        const author = element('details', null, 'xb-variable-help'), content = element('pre');
        author.append(element('summary', COPY.authorTitle));
        paragraphs(author, COPY.authorHelp);
        const actions = element('div', null, 'xb-variable-row');
        actions.append(button(COPY.preview, async () => { content.textContent = JSON.stringify(await api.preview(), null, 2); }, settingsView.notice),
            button(COPY.assistant, async () => { await api.openAssistant(); settingsView.dialog.close(); }, settingsView.notice));
        author.append(actions, content);
        main.append(element('h3', COPY.pluginUpdate), autoLabel, sourceLabel, help, author);
    }
    function renderResult() {
        try { renderUpdateResult(api.result(), resultView.main); }
        catch (error) { resultView.main.replaceChildren(element('p', error.message)); }
    }
    function open() { renderSettings(); if (!settingsView.dialog.open) settingsView.dialog.showModal(); }
    function openResult() { renderResult(); if (!resultView.dialog.open) resultView.dialog.showModal(); }
    function refresh() { if (resultView.dialog.open) renderResult(); }
    function mountControls(target, status) {
        document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove());
        const message = document.querySelector(`.mes[mesid="${target.floor}"] .mes_text`);
        if (!message) return;
        const controls = element('div', null, 'xb-variable-controls lwb-variable-controls');
        const label = element('span', COPY.phases[status.phase]); label.setAttribute('role', 'status');
        controls.append(button(status.busy ? COPY.cancel : status.saveFailed ? COPY.saveChat : ['success', 'recorded', 'noop'].includes(status.phase) ? COPY.retry : COPY.update,
            status.busy ? api.cancel : status.saveFailed ? api.retrySave : api.update),
        button(COPY.details, openResult), button(COPY.settings, open), label);
        if (status.phase === 'saving') controls.querySelector('button').disabled = true;
        message.after(controls);
    }
    return { open, refresh, mountControls, dispose() {
        settingsView.dialog.remove(); resultView.dialog.remove(); style.remove(); document.querySelectorAll('.xb-variable-controls').forEach(node => node.remove());
    } };
}
