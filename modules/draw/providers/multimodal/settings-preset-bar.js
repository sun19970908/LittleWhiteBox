import { createIdentifier } from '../../../../shared/common/identifier.js';
import { observeAsyncCallback } from '../../../../shared/common/async-errors.js';
import { MULTIMODAL_COPY as COPY } from './copy.js';

/** The SD/Comfy select and icon bar, used for both image-parameter and scene-template presets. */
export function bindSettingsPresetBar({ root, label, getState, persist, listKey, selectionKey, readFields, fillFields, fieldset, validateFields = () => {} }) {
    const document = root.ownerDocument;
    const view = document.defaultView;
    root.classList.add('preset-bar');
    const select = document.createElement('select');
    select.className = 'input mm-preset-nav';
    select.setAttribute('aria-label', label);
    const actions = document.createElement('div');
    actions.className = 'btn-group';
    const status = document.createElement('div');
    status.className = 'status-text inline-status';
    status.setAttribute('role', 'status');
    let current;
    let busy = false;
    const buttons = new Map();

    const report = (kind, text) => { status.className = `status-text inline-status ${kind}`; status.textContent = text; };
    const fieldsOf = ({ id, name, ...fields }) => fields;
    const { confirm, prompt } = { confirm: view.confirm.bind(view), prompt: view.prompt.bind(view) };
    const isDirty = () => current && JSON.stringify(readFields()) !== JSON.stringify(fieldsOf(current));
    function render({ force = false } = {}) {
        const state = getState();
        const items = state[listKey];
        const next = items.find(item => item.id === state[selectionKey]);
        const preserve = !force && isDirty();
        if (!preserve && (force || JSON.stringify(next) !== JSON.stringify(current))) {
            current = next;
            fillFields(fieldsOf(next), next.id);
        }
        select.replaceChildren(...items.map(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            if (item.id === current.id) option.setAttribute('selected', '');
            return option;
        }));
        select.disabled = busy;
        if (fieldset) fieldset.disabled = busy;
        for (const [action, button] of buttons) button.disabled = busy || (action === 'delete' && items.length < 2);
    }

    async function apply(mutator, success, { keepFields = false } = {}) {
        if (busy) return;
        busy = true;
        render();
        report('pending', COPY.saving);
        try {
            await persist(mutator);
            render({ force: !keepFields });
            report('success', success);
        } catch (error) {
            report('error', error.message || COPY.saveFailed);
        } finally {
            busy = false;
            render();
        }
    }
    function askName(initial = '') {
        const answer = prompt(COPY.presetName, initial);
        if (answer === null) return null;
        if (!answer.trim()) { report('error', COPY.presetNameRequired); return null; }
        return answer.trim();
    }
    function button(action, icon, text, task, classes = '') {
        const node = document.createElement('button');
        node.type = 'button';
        node.dataset.presetAction = action;
        node.className = `btn ${classes}`.trim();
        node.title = text;
        node.setAttribute('aria-label', text);
        const symbol = document.createElement('i');
        symbol.className = `fa-solid ${icon}`;
        symbol.setAttribute('aria-hidden', 'true');
        node.append(symbol);
        node.addEventListener('click', observeAsyncCallback(task, { source: import.meta.url, operation: action }));
        actions.append(node);
        buttons.set(action, node);
    }
    function saveAs(name, fields) {
        const id = createIdentifier();
        return apply(draft => {
            validateFields(fields);
            draft[listKey].push({ id, name, ...fields });
            draft[selectionKey] = id;
        }, COPY.saved);
    }
    button('add', 'fa-plus', COPY.add, () => {
        const name = askName();
        if (name !== null) return saveAs(name, readFields());
    }, 'btn-icon');
    button('rename', 'fa-pen', COPY.rename, () => {
        const { id, name: oldName } = current;
        const name = askName(oldName);
        if (name === null || name === oldName) return;
        return apply(draft => { draft[listKey].find(item => item.id === id).name = name; }, COPY.presetRenamed, { keepFields: true });
    }, 'btn-icon');
    button('save', 'fa-floppy-disk', COPY.save, () => {
        const { id } = current;
        const fields = readFields();
        return apply(draft => {
            validateFields(fields);
            Object.assign(draft[listKey].find(item => item.id === id), fields);
        }, COPY.saved);
    }, 'btn-primary');
    button('delete', 'fa-trash', COPY.remove, () => {
        if (!confirm(COPY.deleteConfirm)) return;
        const { id } = current;
        return apply(draft => {
            if (draft[listKey].length < 2) throw new Error(COPY.lastPreset);
            const index = draft[listKey].findIndex(item => item.id === id);
            draft[listKey].splice(index, 1);
            if (draft[selectionKey] === id) draft[selectionKey] = draft[listKey][Math.min(index, draft[listKey].length - 1)].id;
        }, COPY.presetDeleted);
    }, 'btn-danger btn-icon');
    select.addEventListener('change', observeAsyncCallback(() => {
        const id = select.value;
        const target = getState()[listKey].find(item => item.id === id);
        if (!target || (isDirty() && !confirm(COPY.discardConfirm))) { select.value = current.id; return; }
        return apply(draft => { draft[selectionKey] = id; }, COPY.presetSelected(target.name));
    }, { source: import.meta.url, operation: 'selectPreset' }));
    root.append(select, actions, status);
    render({ force: true });
    return { render: () => { if (!busy) render(); }, isDirty, saveAs, report, currentName: () => current.name };
}
