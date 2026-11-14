import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { waitForAbortableDelay } from '../shared/common/abort-utils.js';

// A3: background pages must settle once the host is idle without requiring a
// painted frame; a busy/cancelled/changed chat must not settle (lost/wrong state).
function harness() {
    const state = { chatId: 'test', busy: false, dataset: {}, stopVisible: false, frames: 0, waits: 0 };
    const source = readFileSync(new URL('./after-ai-gate.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', "'gate-test'");
    const { waitForAfterAiReady } = runInNewContext(source + '\n({waitForAfterAiReady})', {
        getContext: () => ({ chatId: state.chatId }), isGenerating: () => state.busy,
        document: { body: { dataset: state.dataset }, getElementById: () => ({ isConnected: true }) },
        window: { getComputedStyle: () => ({ display: state.stopVisible ? 'flex' : 'none' }) },
        requestAnimationFrame: () => { state.frames++; return 1; }, cancelAnimationFrame() {},
        waitForAbortableDelay: async (...args) => { state.waits++; await delay(...args); }, setTimeout, clearTimeout,
    });
    return { state, wait: waitForAfterAiReady };
}
const delay = waitForAbortableDelay;

test('A3: a hidden page does not need animation frames to finish waiting', async () => {
    const h = harness(), controller = new AbortController();
    // Abort ensures a regression cannot hang the test process indefinitely.
    const timer = setTimeout(() => controller.abort(), 100);
    try { assert.equal(await h.wait('test', controller.signal), true); }
    finally { clearTimeout(timer); }
    assert.equal(h.state.frames, 0);
});

test('A3: host flags, stop control and chat identity still govern readiness', async () => {
    for (const blocker of ['busy', 'dataset', 'stopVisible']) {
        const h = harness(), controller = new AbortController();
        if (blocker === 'dataset') h.state.dataset.generating = 'true'; else h.state[blocker] = true;
        let resolved = false;
        const pending = h.wait('test', controller.signal).then(result => { resolved = true; return result; });
        await Promise.resolve(); assert.equal(resolved, false); assert.equal(h.state.waits, 1);
        if (blocker === 'dataset') delete h.state.dataset.generating; else h.state[blocker] = false;
        assert.equal(await pending, true);
    }
    for (const boundary of ['abort', 'chat']) {
        const h = harness(), controller = new AbortController(); h.state.busy = true;
        const pending = h.wait('test', controller.signal);
        if (boundary === 'abort') controller.abort(); else h.state.chatId = 'other';
        assert.equal(await pending, false);
    }
});
