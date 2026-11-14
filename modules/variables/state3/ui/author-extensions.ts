import type { Draft } from '../definition/authoring.js';
import type { Definition, ExtensionEntry, ScriptPhase, ToolEntry } from '../types.js';
import { DEFINITION_FILE, SCRIPT_PHASES } from '../definition/format.js';
import { extensionPath } from '../extensions/definition.js';
import { EXTENSION_COPY as C } from '../extensions/copy.js';
import { COPY } from './copy.js';
import { element } from './result.js';

interface AuthorOptions {
    draft(): Draft; update(path: string, content?: string): void;
    button(label: string, action: (signal: AbortSignal) => unknown | Promise<unknown>): HTMLButtonElement;
    assistant(path: string, message: string): Promise<void>;
}

/** Authors choose behavior here; the assistant owns writing and exercising test inputs. */
export function createAuthorExtensions({ draft, update, button, assistant }: AuthorOptions) {
    let expanded = '';
    const definition = () => JSON.parse(draft().files.find(file => file.path === draft().root + DEFINITION_FILE)?.content || '{}') as Definition;
    const saveDefinition = (value: Definition) => update(draft().root + DEFINITION_FILE, JSON.stringify(value, null, 2));
    const row = (...nodes: HTMLElement[]) => { const root = element('div', undefined, 'lwb-state3-actions'); root.append(...nodes); return root; };
    function renderExtensions(root: HTMLElement) {
        let def: Definition;
        try {def = definition();}
        catch {root.append(element('p', C.rulesInvalid), button(C.repair, () => assistant(draft().root + DEFINITION_FILE, C.repairRules))); return;}
        if (!def.updates) { root.append(element('p', C.rulesFirst), button(C.assistant, () => assistant(draft().root + DEFINITION_FILE, C.createRules))); return; }
        root.append(row(element('h3', C.tools), button(C.addTool, () => assistant(draft().root + DEFINITION_FILE, C.writeTool))));
        if (!Object.keys(def.extensions?.tools || {}).length) {root.append(element('p', C.emptyTools, 'lwb-state3-help'));}
        for (const [name, entry] of Object.entries(def.extensions?.tools || {})) {renderEntry(root, 'tool', name, entry);}
        root.append(element('h3', C.scripts));
        for (const phase of SCRIPT_PHASES) {
            const entry = def.extensions?.scripts?.[phase];
            if (entry) {renderEntry(root, phase, phase, entry);}
            else {
                const line = element('section', undefined, 'lwb-state3-extension');
                line.append(row(element('strong', C.phases[phase]), button(C.assistant,
                    () => assistant(draft().root + extensionPath(phase), C.writeScript(C.phases[phase])))), element('p', C.phaseHelp[phase], 'lwb-state3-help'));
                root.append(line);
            }
        }
    }
    function renderEntry(root: HTMLElement, kind: 'tool' | ScriptPhase, name: string, entry: ExtensionEntry) {
        const path = draft().root + extensionPath(kind, name), section = element('section', undefined, 'lwb-state3-extension');
        const enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = entry.enabled;
        const stageNotice = element('p', undefined, 'lwb-state3-help');
        const updateStageNotice = () => { stageNotice.textContent = kind === 'tool' && enabled.checked && !definition().extensions!.tools![name].stages.length ? C.noStages : ''; };
        const toggle = element('label', undefined, 'lwb-state3-check'); toggle.append(enabled, C.enabled);
        const change = (edit: (item: ExtensionEntry & Partial<ToolEntry>) => void) => {
            const current = definition();
            edit(kind === 'tool' ? current.extensions!.tools![name] : current.extensions!.scripts![kind]!); saveDefinition(current);
        };
        enabled.addEventListener('change', () => {change(item => {item.enabled = enabled.checked;}); updateStageNotice();});
        section.append(row(element('strong', kind === 'tool' ? entry.title : C.phases[kind]), toggle), element('p', entry.description, 'lwb-state3-help'));
        if (kind === 'tool') {
            const stages = row();
            for (const stage of definition().updates) {
                const input = element('input'); input.type = 'checkbox'; input.checked = (entry as ToolEntry).stages.includes(stage);
                const label = element('label', undefined, 'lwb-state3-check'); label.append(input, COPY.stageNames[stage]);
                input.addEventListener('change', () => {change(item => {item.stages = input.checked ? [...item.stages!, stage] : item.stages!.filter(value => value !== stage);}); updateStageNotice();});
                stages.append(label);
            }
            section.append(stages, stageNotice); updateStageNotice();
        }
        section.append(row(button(C.modify, () => assistant(path, C.editRequest(entry.title))),
            button(C.assistantTest, () => assistant(path, C.testRequest(entry.title)))));
        const code = element('details'); code.open = expanded === path;
        code.addEventListener('toggle', () => { if (code.open) {expanded = path;} else if (expanded === path) {expanded = '';} });
        const editor = element('textarea', undefined, 'lwb-state3-definition'); editor.rows = 10; editor.spellcheck = false;
        editor.value = draft().files.find(file => file.path === path)?.content || ''; editor.setAttribute('aria-label', C.edit);
        editor.addEventListener('input', () => update(path, editor.value));
        code.append(element('summary', C.edit), editor, button(C.remove, () => {
            if (!globalThis.confirm(C.removeConfirm)) {return;}
            const current = definition();
            if (kind === 'tool') {delete current.extensions!.tools![name];} else {delete current.extensions!.scripts![kind];}
            update(path); saveDefinition(current); root.replaceChildren(); renderExtensions(root);
        }));
        section.append(code); root.append(section);
    }
    return { renderExtensions, select(path: string) {expanded = path;}, clear() {expanded = '';} };
}
