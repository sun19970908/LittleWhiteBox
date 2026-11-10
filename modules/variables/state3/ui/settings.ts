import { observeBackgroundTask } from '../../../../shared/common/async-errors.js';
import styleText from './styles.css?inline';
import { COPY, errorText } from './copy.js';
import { element, resultLabel } from './result.js';
import { createResultDialog } from './result-dialog.js';
import { notifyInfo } from './notifications.js';
import { DEFINITION_FILE, FUNCTION_DIRECTORY } from '../definition/format.js';
import type { State3Api } from '../runtime/api.js';
import type { Draft } from '../definition/authoring.js';
import type { JsonObject, Schema, Result } from '../types.js';
import type { UpdaterSettings } from '../runtime/settings.js';

type Action = (signal: AbortSignal) => unknown | Promise<unknown>;
export function createState3Page(api: State3Api) {
    const style = element('style', styleText), dialog = element('dialog', undefined, 'lwb-state3-dialog');
    const header = element('header'), nav = element('nav'), main = element('main'), notice = element('output');
    const resultDialog = createResultDialog(api);
    notice.setAttribute('role', 'status');
    let page: 'play' | 'author' = 'play', draft: Draft | undefined, working = new Map<string, string>(), selectedFile = '';
    let controller: AbortController | undefined, generation = 0;
    const button = (label: string, action: Action) => {
        const node = element('button', label, 'menu_button'); node.type = 'button';
        node.addEventListener('click', () => { observeBackgroundTask(act(action, node), { source: import.meta.url, operation: 'pageAction' }); });
        return node;
    };
    function cancel() { generation++; controller?.abort(); }
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
        choose();
        const intro = element('section', undefined, 'lwb-state3-intro');
        for (const text of COPY.authorHelp) {intro.append(element('p', text));}
        intro.append(row(button(COPY.assistant, async () => { await api.openAssistant(); dialog.close(); })));
        main.append(intro, label(COPY.file, select), editor);
        main.append(row(
            button(COPY.check, async signal => { resultDialog.showCheck(await api.checkDraft(currentDraft(), [], { signal })); }),
            button(COPY.saveDraft, async () => { draft = await api.saveDraft(currentDraftBaseline(), [...working].map(([path, content]) => ({ path, content }))); notice.textContent = COPY.savedDraft; }),
            button(COPY.saveCard, async () => {
                draft = await api.saveDraft(currentDraftBaseline(), [...working].map(([path, content]) => ({ path, content })));
                const result = await api.saveCardDraft(draft);
                if (!('ok' in result) || !result.ok) {throw new Error('results' in result ? result.results.filter((item: { saved: boolean }) => !item.saved).map((item: { error: string }) => item.error).join('\n') : COPY.failed);}
                draft = await api.openDraft(); notice.textContent = COPY.savedCard;
            }),
            button(COPY.newFunction, () => {
                const name = globalThis.prompt(COPY.functionName);
                if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {return;}
                selectedFile = rootPath + FUNCTION_DIRECTORY + name + '.js';
                if (!working.has(selectedFile)) {working.set(selectedFile, '(input, { get, before }) => null');}
                choose();
            }),
        ));
        const request = element('pre'); request.hidden = true;
        main.append(row(button(COPY.previewRequest, async signal => {
            request.textContent = JSON.stringify(await api.previewRequest({ signal }), null, 2); request.hidden = false;
        })), request);
    }
    function currentDraftBaseline() { if (!draft) {throw new Error(COPY.notEnabled);} return draft; }
    function parameterEditor(schema: Schema) {
        const root = element('div'), readers: [string, () => JsonObject[string] | undefined][] = [];
        const readJson = (input: HTMLTextAreaElement, name: string) => {
            try { return JSON.parse(input.value); }
            catch { throw new Error(COPY.parameterFormat(name)); }
        };
        // Schema descriptions are written for the update model; the form shows titles, types and limits only.
        const hints = (target: HTMLElement, property: Record<string, unknown>) => {
            const object = property.type === 'array' ? property.items : property;
            if (!object || typeof object !== 'object' || !('properties' in object) || !object.properties || typeof object.properties !== 'object') {return;}
            const required = new Set('required' in object && Array.isArray(object.required) ? object.required : []);
            const fields = element('dl', undefined, 'lwb-state3-parameter-fields');
            for (const [key, field] of Object.entries(object.properties as Record<string, Record<string, unknown>>)) {
                const name = field.title ? `${String(field.title)} (${key})` : key;
                fields.append(element('dt', name), element('dd', [required.has(key) ? COPY.required : COPY.optional,
                    COPY.parameterTypes[String(field.type)]].filter(Boolean).join(' · ')));
            }
            target.append(element('p', property.type === 'array' ? COPY.itemFields : COPY.objectFields, 'lwb-state3-parameter-help'), fields);
        };
        const properties = typeof schema === 'object' && schema.properties && typeof schema.properties === 'object' ? schema.properties as Record<string, Record<string, unknown>> : {};
        // A closed flat object has an ordinary form. Keep the full input surface for
        // schemas whose legal keys depend on parameters, alternatives or references.
        if (typeof schema !== 'object' || schema.additionalProperties !== false
            || ['oneOf', 'anyOf', 'allOf', 'if', '$ref', 'patternProperties', 'dependentSchemas'].some(key => key in schema)) {
            const input = element('textarea', '{}'); root.append(label(COPY.parameters, input));
            if (typeof schema === 'object') {hints(root, schema);}
            return { root, read: (): JsonObject => readJson(input, COPY.parameterName) };
        }
        const required = new Set(Array.isArray(schema.required) ? schema.required : []);
        for (const [name, property] of Object.entries(properties)) {
            const title = String(property.title || name);
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
                if (input.type === 'number') {
                    if (typeof property.minimum === 'number') {input.min = String(property.minimum);}
                    if (typeof property.maximum === 'number') {input.max = String(property.maximum);}
                    input.step = property.type === 'integer' ? '1' : 'any';
                }
                root.append(label(title, input)); readers.push([name, () => input.value === '' && (optional || input.type === 'number') ? undefined : input.type === 'number' ? Number(input.value) : input.value]);
            } else {
                const input = element('textarea', property.default === undefined && optional ? '' : JSON.stringify(property.default ?? (property.type === 'array' ? [] : {})));
                root.append(label(title, input)); readers.push([name, () => optional && !input.value.trim() ? undefined : readJson(input, title)]);
            }
            hints(root, property);
        }
        return { root, read: (): JsonObject => Object.fromEntries(readers.flatMap(([key, read]) => { const value = read(); return value === undefined ? [] : [[key, value]]; })) };
    }
    async function renderPlay() {
        const status = await api.inspect();
        if (!status.ok) {
            main.append(element('p', COPY.notEnabled), button(COPY.enable, async signal => { const result = await api.enable({ signal }); await render(); resultDialog.show(result); }));
            return;
        }
        const definition = status.bundle.definition;
        const present = (result: Result) => {
            resultDialog.show(result, result.ok && result.version === status.version ? definition : undefined);
        };
        main.append(element('p', COPY.playHelp, 'lwb-state3-intro'));
        const settings = element('section'), current = api.settings(), auto = element('input'), source = element('select');
        auto.type = 'checkbox'; auto.checked = current.auto;
        for (const [key, text] of Object.entries(COPY.sources)) { const option = element('option', text); option.value = key; source.append(option); }
        source.value = current.source;
        const save = () => api.saveSettings({ auto: auto.checked, source: source.value as UpdaterSettings['source'] });
        auto.addEventListener('change', save); source.addEventListener('change', save);
        const autoLabel = element('label', undefined, 'lwb-state3-check'); autoLabel.append(auto, COPY.auto);
        settings.append(element('h3', COPY.pluginUpdate), autoLabel, label(COPY.model, source), element('p', COPY.pluginUpdateHelp, 'lwb-state3-parameter-help'));
        main.append(settings);
        if (!definition.actions.length) {return;}
        const actions = element('section');
        actions.append(element('h3', COPY.action), element('p', COPY.actionHelp, 'lwb-state3-parameter-help'));
        const selector = element('select'), parameterRoot = element('div');
        selector.setAttribute('aria-label', COPY.action);
        for (const action of definition.actions) { const option = element('option', action.title); option.value = action.id; selector.append(option); }
        let parameters = parameterEditor(definition.actions[0].parameters);
        parameterRoot.append(parameters.root);
        selector.addEventListener('change', () => {
            const action = definition.actions.find(action => action.id === selector.value)!;
            parameters = parameterEditor(action.parameters); parameterRoot.replaceChildren(parameters.root);
        });
        const run = (preview: boolean): Action => async signal => {
            const result = await api[preview ? 'preview' : 'apply']([{ action: selector.value, params: parameters.read() }], { signal });
            present(result);
        };
        actions.append(selector, parameterRoot, row(button(COPY.preview, run(true)), button(COPY.commit, run(false))));
        main.append(actions);
    }
    async function render() {
        main.replaceChildren(); nav.replaceChildren();
        for (const [key, text] of [['play', COPY.play], ['author', COPY.author]] as const) {
            const tab = button(text, async () => { page = key; await render(); }); tab.setAttribute('aria-selected', String(key === page)); nav.append(tab);
        }
        if (page === 'author') {await renderAuthor();} else { await renderPlay(); return; }
        const picker = element('input'); picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
        const importButton = button(COPY.importRules, () => picker.click());
        picker.addEventListener('change', () => {
            const file = picker.files?.[0]; picker.value = ''; if (!file) {return;}
            observeBackgroundTask(act(async signal => {
                const prepared = await api.prepareRuleImport(await file.text(), { signal });
                signal.throwIfAborted();
                if (!globalThis.confirm(COPY.importConfirm)) {return;}
                await api.importRules(prepared, { signal });
                notice.textContent = COPY.importedRules;
            }, importButton), { source: import.meta.url, operation: 'importRules' });
        });
        main.append(row(importButton,
            button(COPY.exportRules, async signal => {
                const bundle = await api.exportRules({ signal });
                const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
                const link = element('a'); link.href = url; link.download = 'variables-3.0.json'; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 0);
                notice.textContent = COPY.exportedRules;
            })), picker);
    }
    header.append(element('h2', COPY.title), button(COPY.close, () => dialog.close()));
    dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
    dialog.append(header, nav, main, notice); document.head.append(style); document.body.append(dialog);
    return {
        async open(nextPage: 'play' | 'author' = 'play') { page = nextPage; await render(); if (!dialog.open) {dialog.showModal();} },
        targetChanged() { cancel(); api.cancel(); resultDialog.clear(); draft = undefined; working = new Map(); if (dialog.open) {dialog.close();} },
        mountControl(index: number, results: { index: number; result: Result }[]) {
            document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove());
            const status = api.updateStatus(); resultDialog.sync(results, index, status);
            for (const floor of new Set([index, ...results.map(item => item.index)])) {
                const floorTarget = document.querySelector(`.mes[mesid="${floor}"] .mes_text`);
                if (floorTarget) {
                    const group = element('div', undefined, 'lwb-state3-controls'), last = results.find(item => item.index === floor)?.result;
                    group.dataset.floor = String(floor);
                    if (floor === index && status.busy) {group.append(button(COPY.cancel, api.cancel));}
                    else if (last?.ok && last.saved === false) {group.append(button(COPY.retrySave, () => api.retrySave()));}
                    else if (floor === index) {group.append(button(COPY.update, () => api.update()));}
                    const label = element('span', floor === index && status.busy ? COPY.phases[status.phase] : last ? resultLabel(last) : COPY.noResult);
                    label.setAttribute('role', 'status'); group.append(label, button(COPY.result, () => resultDialog.open(floor)));
                    if (floor === index) {group.append(button(COPY.settings, () => this.open()));}
                    floorTarget.after(group);
                }
            }
        },
        dispose() { cancel(); api.cancel(); resultDialog.dispose(); dialog.remove(); style.remove(); document.querySelectorAll('.lwb-state3-controls').forEach(node => node.remove()); },
    };
}
