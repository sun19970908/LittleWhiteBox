import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import ts from 'typescript';
import { COPY } from '../ui/copy.js';
import { element, resultLabel } from '../ui/result.js';
import { createResultDialog } from '../ui/result-dialog.js';
import type { State3Api } from '../runtime/api.js';
import type { createState3Page } from '../ui/settings.js';

// U3: no saved result must not strand the latest player turn after reload/cancel;
// recovery targets only that turn and does not purchase an update by merely opening UI (cost / dead end).
test('U3: unsettled latest USER has direct settle/skip controls, UI cleanup does not cancel model work', async t => {
    const { document } = parseHTML('<html><head></head><body>' + [0, 1, 2, 3].map(index => `<div class="mes" mesid="${index}"><div class="mes_text"></div></div>`).join('') + '</body></html>');
    const previous = globalThis.document; globalThis.document = document; t.after(() => {globalThis.document = previous;});
    const settled: number[] = [], skipped: number[] = [], tasks: Promise<unknown>[] = [];
    let cancelled = 0;
    const api = { updateStatus: () => ({ busy: false, phase: 'ready' }),
        recomputeBefore: async (index: number) => {settled.push(index);}, skipBefore: async (index: number) => {skipped.push(index);},
        cancel: () => {cancelled++;},
    } as unknown as State3Api;
    const source = ts.transpileModule(readFileSync(new URL('../ui/settings.ts', import.meta.url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'controls-test'");
    const create = runInNewContext(source + '\ncreateState3Page', { document, AbortController, COPY, element, resultLabel,
        createResultDialog, styleText: '', controlsCss: '', observeBackgroundTask: (task: Promise<unknown>) => tasks.push(task),
    }) as typeof createState3Page;
    const page = create(api); t.after(() => page.dispose());
    for (const updates of [['before'], ['before', 'after']] as ('before' | 'after')[][]) {
        page.mountControl(2, [], { updates, beforeIndex: 3 });
        const group = document.querySelector('.lwb-state3-controls[data-floor="3"]'); assert.ok(group);
        const click = (label: string) => {const button = [...group.querySelectorAll('button')].find(node => node.textContent === label); assert.ok(button); button.click();};
        click(COPY.settleBefore); await Promise.all(tasks.splice(0));
        click(COPY.skipBefore); await Promise.all(tasks.splice(0));
        assert.equal(document.querySelector('.lwb-state3-controls[data-floor="1"]'), null);
    }
    assert.deepEqual(settled, [3, 3]); assert.deepEqual(skipped, [3, 3]);
    page.mountControl(2, [], { updates: ['after'], beforeIndex: -1 });
    assert.equal(document.querySelector('.lwb-state3-controls[data-floor="3"]'), null);
    page.mountControl(2, [], { updates: ['before'], beforeIndex: -1 });
    assert.equal(document.querySelector('.lwb-state3-controls'), null);
    page.targetChanged(); assert.equal(cancelled, 0);
});
