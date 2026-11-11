import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createResultDialog } from '../ui/result-dialog.js';
import { COPY } from '../ui/copy.js';
import type { State3Api } from '../runtime/api.js';
import type { Success } from '../types.js';

// U1: result actions belong to the selected reply/swipe; retry only persists,
// never repeats settlement, and closing the viewer never cancels an update
// (wrong-reply edits / duplicate increments / invisible data loss).
test('U1: the shared result dialog follows selection and retries only persistence', async () => {
    const { document, Event } = parseHTML('<html><body></body></html>');
    const previous = globalThis.document; globalThis.document = document;
    let retries = 0, cancelled = 0;
    const undone: number[] = [];
    const result = (value: number, saved = true): Success => ({ ok: true, committed: true, saved,
        state: { coins: value }, changes: [{ path: ['coins'], before: 10, after: value, removed: false }],
        actions: [], provenance: [], diagnostics: [], receipt: { id: String(value), revision: 1, source: 'model', delta: null, actions: [] } });
    const first = result(15), second = result(18, false);
    let current = second;
    const api = {
        retrySave: async () => { retries++; current = { ...current, saved: true }; view.sync([{ index: 0, result: first }, { index: 2, result: current }], 2, ready); },
        lastResult: () => current, undo: async ({ index }: { index: number }) => { undone.push(index); },
        cancel: () => { cancelled++; }, update: () => { throw new Error('Retry must not update'); },
    } as unknown as State3Api;
    const ready = { busy: false, phase: 'ready' } as ReturnType<State3Api['updateStatus']>;
    const view = createResultDialog(api), dialog = document.querySelector('dialog')!;
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
    const expand = () => {
        const group = dialog.querySelector('details')!;
        group.open = true; group.dispatchEvent(new Event('toggle'));
    };
    const click = async (label: string) => {
        const button = [...dialog.querySelectorAll('button')].find(node => node.textContent === label)!;
        assert.ok(button); button.click(); await new Promise(resolve => setTimeout(resolve, 0));
    };
    try {
        view.sync([{ index: 0, result: first }, { index: 2, result: second }], 2, ready);
        view.open(0); expand(); assert.match(dialog.querySelector('.lwb-state3-change')!.textContent!, /15/);
        await click(COPY.undoReply); assert.deepEqual(undone, [0]);
        view.open(2); await click(COPY.retrySave); assert.equal(retries, 1);
        assert.equal([...dialog.querySelectorAll('button')].some(node => node.textContent === COPY.retrySave), false);
        await click(COPY.close); assert.equal(cancelled, 0); assert.equal(dialog.open, false);
        assert.equal(dialog.querySelector('main')!.childElementCount, 0);
        view.open(2); view.clear(); assert.equal(dialog.open, false);
        view.sync([{ index: 2, result: result(25) }], 2, ready); view.open(2);
        expand();
        assert.match(dialog.querySelector('.lwb-state3-change')!.textContent!, /25/);
        assert.doesNotMatch(dialog.querySelector('.lwb-state3-change')!.textContent!, /18/);
    } finally { view.dispose(); globalThis.document = previous; }
});
