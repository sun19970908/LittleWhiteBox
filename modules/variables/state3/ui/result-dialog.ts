import { observeBackgroundTask } from '../../../../shared/common/async-errors.js';
import { COPY, errorText } from './copy.js';
import { element, showCheck, showResult } from './result.js';
import type { Definition, Result } from '../types.js';
import type { State3Api } from '../runtime/api.js';

export interface FloorResult { index: number; result: Result }

/** The selected floor's current swipe, projected by the runtime; never a second history. */
export function createResultDialog(api: State3Api) {
    const dialog = element('dialog', undefined, 'lwb-state3-dialog lwb-state3-result-dialog');
    const header = element('header'), title = element('h2', COPY.result), main = element('main'), notice = element('output');
    notice.setAttribute('role', 'status');
    let results: FloorResult[] = [], selected: number | undefined, standalone: Result | undefined, definition: Definition | undefined, check = false;
    let busyIndex = -1, phase = '';
    const button = (label: string, action: () => unknown | Promise<unknown>) => {
        const node = element('button', label, 'menu_button'); node.type = 'button';
        node.addEventListener('click', () => observeBackgroundTask((async () => {
            node.disabled = true; notice.textContent = '';
            try { await action(); }
            catch (error) { notice.textContent = errorText(error); }
            finally { node.disabled = false; }
        })(), { source: import.meta.url, operation: 'resultAction' }));
        return node;
    };
    function render() {
        main.replaceChildren();
        const result = selected === undefined ? standalone : results.find(item => item.index === selected)?.result;
        title.textContent = selected !== undefined ? COPY.floorResult(selected) : check ? COPY.checkTitle : result?.ok && !result.committed ? COPY.previewTitle : COPY.result;
        if (check && result) { const output = element('section'); showCheck(output, result); main.append(output); return; }
        if (selected === busyIndex) {main.append(element('p', COPY.phases[phase], 'lwb-state3-status'));}
        if (!result) { main.append(element('p', COPY.noResult)); return; }
        const output = element('section'); showResult(output, result, definition); main.append(output);
        const actions = element('div', undefined, 'lwb-state3-actions');
        if (result.ok && result.saved === false) {
            actions.append(button(COPY.retrySave, async () => {
                notice.textContent = COPY.phases.saving;
                await api.retrySave();
                if (selected === undefined) {standalone = api.lastResult();}
                notice.textContent = ''; render();
            }));
        }
        if (selected !== undefined && result.ok && result.receipt && selected !== busyIndex) {
            const index = selected;
            actions.append(button(COPY.undoReply, () => api.undo({ index, all: true })));
        }
        main.append(actions);
    }
    header.append(title, button(COPY.close, () => dialog.close()));
    dialog.append(header, main, notice); document.body.append(dialog);
    return {
        sync(next: FloorResult[], index: number, status: ReturnType<State3Api['updateStatus']>) {
            results = next; busyIndex = status.busy ? index : -1; phase = status.phase;
            if (dialog.open && selected !== undefined) {render();}
        },
        open(index: number) {
            selected = index; standalone = undefined; definition = undefined; check = false; notice.textContent = ''; render();
            if (!dialog.open) {dialog.showModal();}
        },
        show(result: Result, rules?: Definition) {
            selected = undefined; standalone = result; definition = rules; check = false; notice.textContent = ''; render();
            if (!dialog.open) {dialog.showModal();}
        },
        showCheck(result: Result) {
            selected = undefined; standalone = result; definition = undefined; check = true; notice.textContent = ''; render();
            if (!dialog.open) {dialog.showModal();}
        },
        clear() { results = []; selected = undefined; standalone = undefined; if (dialog.open) {dialog.close();} },
        dispose() {dialog.remove();},
    };
}
