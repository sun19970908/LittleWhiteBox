import { observeBackgroundTask } from '../../../../shared/common/async-errors.js';
import styleText from './styles.css?inline';
import { COPY, errorText, restorationLabel } from './copy.js';
import { element, showResult } from './result.js';
import { notifyInfo } from './notifications.js';
import { DEFINITION_FILE, FUNCTION_DIRECTORY } from '../definition/format.js';
import { equipmentExample } from '../definition/example.js';
import type { State3Api } from '../runtime/api.js';
import type { Draft } from '../definition/authoring.js';
import type { JsonObject, Schema, Result } from '../types.js';
import type { UpdaterSettings } from '../runtime/settings.js';

type Action = (signal: AbortSignal) => unknown | Promise<unknown>;
export function createState3Page(api: State3Api) {
    const style = element('style', styleText), dialog = element('dialog', undefined, 'lwb-state3-dialog');
    const header = element('header'), nav = element('nav'), main = element('main'), notice = element('output');
    notice.setAttribute('role', 'status');
    let page: 'play' | 'author' = 'play', draft: Draft | undefined, working = new Map<string, string>(), selectedFile = '';
    let controller: AbortController | undefined, generation = 0;
    const button = (label: string, action: Action) => {
        const node = element('button', label, 'menu_button'); node.type = 'button';
        node.addEventListener('click', () => { observeBackgroundTask(act(action, node), { source: import.meta.url, operation: 'pageAction' }); });
        return node;
    };
    function cancel() { generation++; controller?.abort(); api.cancel(); }
    async function act(action: Action, node: HTMLButtonElement) {
        controller?.abort(); const turn = ++generation;
        controller = new AbortController(); node.disabled = true; notice.textContent = '';
        try { await action(controller.signal); }
        catch (error) { if (turn === generation) { notice.textContent = errorText(error); notifyInfo(errorText(error)); } }
        finally { node.disabled = false; }
    }
    const row = (...nodes: HTMLElement[]) => { const root = element('div', undefined, 'lwb-state3-actions'); root.append(...nodes); return root; };
    const label = (text: string, node: HTMLElement) => { const root = element('label', text); root.append(node); return root; };
    function currentDraft(): Draft {
        if (!draft) {throw new Error(COPY.notEnabled);}
        return { ...draft, files: [...working].map(([path, content]) => ({ ...draft!.files.find(file => file.path === path), path, content })) };
    }
    async function loadDraft() {
        draft = await api.openDraft(); working = new Map(draft.files.map(file => [file.path, file.content]));
        selectedFile = draft.root + DEFINITION_FILE;
        if (!working.has(selectedFile)) {working.set(selectedFile, '');}
    }
    async function renderAuthor() {
        if (!draft) {await loadDraft();}
        const rootPath = draft!.root;
        const select = element('select'), editor = element('textarea', undefined, 'lwb-state3-definition');
        editor.spellcheck = false; editor.setAttribute('aria-label', COPY.draft);
        function choose() {
            select.replaceChildren();
            for (const path of working.keys()) { const option = element('option', path.slice(rootPath.length)); option.value = path; select.append(option); }
            select.value = selectedFile; editor.value = working.get(selectedFile) || '';
        }
        select.addEventListener('change', () => { selectedFile = select.value; editor.value = working.get(selectedFile) || ''; });
        editor.addEventListener('input', () => working.set(selectedFile, editor.value));
        choose(); main.append(select, editor);
        const output = element('section', undefined, 'lwb-state3-result');
        main.append(row(
            button(COPY.saveDraft, async () => { draft = await api.saveDraft(currentDraftBaseline(), [...working].map(([path, content]) => ({ path, content }))); notice.textContent = COPY.savedDraft; }),
            button(COPY.check, async signal => { showResult(output, await api.checkDraft(currentDraft(), [], { signal })); }),
            button(COPY.saveCard, async () => {
                draft = await api.saveDraft(currentDraftBaseline(), [...working].map(([path, content]) => ({ path, content })));
                const result = await api.saveCardDraft(draft);
                if (!('ok' in result) || !result.ok) {throw new Error('results' in result ? result.results.filter((item: { saved: boolean }) => !item.saved).map((item: { error: string }) => item.error).join('\n') : COPY.failed);}
                draft = await api.openDraft(); notice.textContent = COPY.savedCard;
            }),
        ), output);
        const files = element('details'); files.append(element('summary', COPY.files), row(
            button(COPY.example, () => {
                if (editor.value.trim() && !globalThis.confirm(COPY.exampleConfirm)) {return;}
                selectedFile = rootPath + DEFINITION_FILE;
                working.set(selectedFile, JSON.stringify(equipmentExample().definition, null, 2)); choose();
            }),
            button(COPY.newFunction, () => {
                const name = globalThis.prompt(COPY.functionName);
                if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {return;}
                selectedFile = rootPath + FUNCTION_DIRECTORY + name + '.js';
                if (!working.has(selectedFile)) {working.set(selectedFile, '(input, { get, before }) => null');}
                choose();
            }),
        )); main.append(files);
    }
    function currentDraftBaseline() { if (!draft) {throw new Error(COPY.notEnabled);} return draft; }
    function parameterEditor(schema: Schema) {
        const root = element('div'), readers: [string, () => JsonObject[string] | undefined][] = [];
        const properties = typeof schema === 'object' && schema.properties && typeof schema.properties === 'object' ? schema.properties as Record<string, Record<string, unknown>> : {};
        // A closed flat object has an ordinary form. Keep the full input surface for
        // schemas whose legal keys depend on parameters, alternatives or references.
        if (typeof schema !== 'object' || schema.additionalProperties !== false
            || ['oneOf', 'anyOf', 'allOf', 'if', '$ref', 'patternProperties', 'dependentSchemas'].some(key => key in schema)) {
            const input = element('textarea', '{}'); root.append(label(COPY.parameters, input));
            return { root, read: (): JsonObject => JSON.parse(input.value) };
        }
        const required = new Set(Array.isArray(schema.required) ? schema.required : []);
        for (const [name, property] of Object.entries(properties)) {
            const title = String(property.title || property.description || name);
            const optional = !required.has(name);
            if (property.type === 'boolean' && !optional) {
                const input = element('input'); input.type = 'checkbox'; input.checked = property.default === true;
                root.append(label(title, input)); readers.push([name, () => input.checked]);
            } else if (Array.isArray(property.enum) || property.type === 'boolean') {
                const input = element('select');
                if (optional) { const option = element('option', COPY.omitParameter); option.value = ''; input.append(option); }
                const values = Array.isArray(property.enum) ? property.enum : [true, false];
                for (const value of values) { const option = element('option', String(value)); option.value = JSON.stringify(value); input.append(option); }
                if (property.default !== undefined) {input.value = JSON.stringify(property.default);}
                root.append(label(title, input)); readers.push([name, () => input.value === '' ? undefined : JSON.parse(input.value)]);
            } else if (['string', 'number', 'integer'].includes(String(property.type))) {
                const input = element('input'); input.type = property.type === 'string' ? 'text' : 'number'; input.value = String(property.default ?? '');
                root.append(label(title, input)); readers.push([name, () => input.value === '' && (optional || input.type === 'number') ? undefined : input.type === 'number' ? Number(input.value) : input.value]);
            } else {
                const input = element('textarea', property.default === undefined && optional ? '' : JSON.stringify(property.default ?? (property.type === 'array' ? [] : {})));
                root.append(label(title, input)); readers.push([name, () => optional && !input.value.trim() ? undefined : JSON.parse(input.value)]);
            }
        }
        return { root, read: (): JsonObject => Object.fromEntries(readers.flatMap(([key, read]) => { const value = read(); return value === undefined ? [] : [[key, value]]; })) };
    }
    async function renderPlay() {
        const status = await api.inspect();
        if (!status.ok) {
            main.append(element('p', COPY.notEnabled), button(COPY.enable, async signal => { const result = await api.enable({ signal }); await render(); const output = element('section'); main.append(output); showResult(output, result); }));
            return;
        }
        const definition = status.bundle.definition;
        const output = element('section', undefined, 'lwb-state3-result');
        const present = (result: Result) => {
            showResult(output, result, result.ok && result.version === status.version ? definition : undefined);
            if (result.ok && result.saved === false) {
                output.append(button(COPY.retrySave, async () => {
                    await api.retrySave(); const saved = api.lastResult(); if (saved) {present(saved);}
                }));
            }
        };
        main.append(row(button(COPY.update, async () => {
            const result = await api.update(); present(result);
        })), output);
        const last = api.lastResult(); if (last) {present(last);}
        const settings = element('details'); settings.append(element('summary', COPY.updateSettings));
        const current = api.settings(), mode = element('select'), source = element('select');
        for (const [key, text] of Object.entries(COPY.modes)) { const option = element('option', text); option.value = key; mode.append(option); }
        for (const [key, text] of Object.entries(COPY.sources)) { const option = element('option', text); option.value = key; source.append(option); }
        mode.value = current.mode; source.value = current.source;
        const save = () => api.saveSettings({ mode: mode.value as UpdaterSettings['mode'], source: source.value as UpdaterSettings['source'] });
        mode.addEventListener('change', save); source.addEventListener('change', save);
        settings.append(label(COPY.mode, mode), label(COPY.model, source)); main.append(settings);
        const actions = element('details'); actions.append(element('summary', COPY.action));
        if (definition.actions.length) {
            const selector = element('select'), parameterRoot = element('div');
            for (const action of definition.actions) { const option = element('option', action.description); option.value = action.id; selector.append(option); }
            let parameters = parameterEditor(definition.actions[0].parameters);
            parameterRoot.append(parameters.root);
            selector.addEventListener('change', () => { parameters = parameterEditor(definition.actions.find(action => action.id === selector.value)!.parameters); parameterRoot.replaceChildren(parameters.root); });
            const run = (preview: boolean): Action => async signal => {
                const result = await api[preview ? 'preview' : 'apply']([{ action: selector.value, params: parameters.read() }], { signal });
                present(result);
            };
            actions.append(selector, parameterRoot, row(button(COPY.preview, run(true)), button(COPY.commit, run(false))));
        }
        actions.append(button(COPY.undo, async signal => { const result = await api.undo({ signal }); await render(); const node = element('section'); main.append(node); showResult(node, result, definition); }));
        main.append(actions);
        const manage = element('details'); manage.append(element('summary', COPY.savedRules), row(
            button(COPY.previewRequest, async signal => { const preview = element('pre', JSON.stringify(await api.previewRequest({ signal }), null, 2)); manage.append(preview); }),
        )); main.append(manage);
    }
    async function render() {
        main.replaceChildren(); nav.replaceChildren();
        for (const [key, text] of [['play', COPY.play], ['author', COPY.author]] as const) {
            const tab = button(text, async () => { page = key; await render(); }); tab.setAttribute('aria-selected', String(key === page)); nav.append(tab);
        }
        nav.append(button(COPY.assistant, async () => { await api.openAssistant(); dialog.close(); }));
        if (page === 'author') {await renderAuthor();} else {await renderPlay();}
        const picker = element('input'); picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
        const importButton = button(COPY.importRules, () => picker.click());
        picker.addEventListener('change', () => {
            const file = picker.files?.[0]; picker.value = ''; if (!file) {return;}
            observeBackgroundTask(act(async signal => {
                const prepared = await api.prepareRuleImport(await file.text(), { signal });
                signal.throwIfAborted();
                if (!globalThis.confirm(COPY.importConfirm)) {return;}
                await api.importRules(prepared, { signal });
                if (page === 'play') {await render();}
                notice.textContent = COPY.importedRules;
            }, importButton), { source: import.meta.url, operation: 'importRules' });
        });
        const transfer = element('details'); transfer.append(element('summary', COPY.ruleFiles), row(importButton,
            button(COPY.exportRules, async signal => {
                const bundle = await api.exportRules({ signal });
                const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
                const link = element('a'); link.href = url; link.download = 'variables-3.0.json'; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 0);
                notice.textContent = COPY.exportedRules;
            })), picker);
        main.append(transfer);
    }
    header.append(element('h2', COPY.title), button(COPY.close, () => dialog.close()));
    dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
    dialog.append(header, nav, main, notice); document.head.append(style); document.body.append(dialog);
    return {
        async open(nextPage: 'play' | 'author' = 'play') { page = nextPage; await render(); if (!dialog.open) {dialog.showModal();} },
        targetChanged() { cancel(); draft = undefined; working = new Map(); if (dialog.open) {dialog.close();} },
        mountControl(index: number, results: { index: number; result: Result }[]) {
            const expanded = new Set([...document.querySelectorAll<HTMLElement>('.lwb-state3-controls:has(details[open])')].map(node => node.dataset.floor));
            document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove());
            const target = document.querySelector(`.mes[mesid="${index}"] .mes_text`);
            const controls = element('div', undefined, 'lwb-state3-controls'), status = api.updateStatus();
            controls.dataset.floor = String(index);
            if (status.busy) {controls.append(element('span', COPY.phases[status.phase]), button(COPY.cancel, api.cancel));}
            else {
                if (api.settings().mode !== 'off') {controls.append(button(COPY.update, () => api.update()));}
                controls.append(button(COPY.title, () => this.open()));
            }
            target?.after(controls);
            for (const { index: floor, result: last } of results) {
                const floorTarget = document.querySelector(`.mes[mesid="${floor}"] .mes_text`);
                if (floorTarget) {
                    const group = floor === index ? controls : element('div', undefined, 'lwb-state3-controls');
                    group.dataset.floor = String(floor);
                    const details = element('details'), result = element('section');
                    details.append(element('summary', last.ok ? last.saved === false ? COPY.phases.unsaved : last.restoration ? restorationLabel(last) : COPY.success : COPY.failed), result);
                    if (!last.ok || last.saved === false || last.restoration?.length || expanded.has(String(floor))) {details.open = true;}
                    let rendered = false;
                    const reveal = () => {
                        if (details.open && !rendered) {
                            showResult(result, last);
                            if (last.ok && last.receipt) {result.append(button(COPY.undoReply, () => api.undo({ index: floor, all: true })));}
                            rendered = true;
                        }
                    };
                    details.addEventListener('toggle', reveal); reveal(); group.append(details);
                    if (last.ok && last.saved === false) {group.append(button(COPY.retrySave, () => api.retrySave()));}
                    if (floor !== index) {floorTarget.after(group);}
                }
            }
        },
        dispose() { cancel(); dialog.remove(); style.remove(); document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove()); },
    };
}
