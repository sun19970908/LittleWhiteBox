import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { COPY, playerErrorText } from '../ui/copy.js';
import { showDiagnostics } from '../ui/result.js';
import type { Diagnostic } from '../types.js';

// Model failures must keep the provider's reason/status and the right next step;
// an HTTP status alone must never turn a save/script failure into an API error.
test('model failure presentation keeps provider details and distinguishes configuration from local failures', () => {
    const causes: Diagnostic[] = [
        { code: 'AGENT_REQUEST_FAILED', message: 'Connection error.' },
        { code: 'invalid_api_key', status: 401, message: 'Invalid API key' },
        { code: 'AGENT_PROVIDER_ERROR', status: 429, message: 'quota exhausted' },
        { code: 'constraint', status: 503, message: 'upstream unavailable' },
        { code: 'execution', message: 'Failed to fetch' },
        { code: 'constructor', status: 500, message: 'vendor-specific code' },
        ...Object.keys(COPY.modelErrors).map(code => ({ code })),
    ];
    for (const cause of causes) {
        const text = playerErrorText({ code: 'model-request', cause });
        const label = Object.entries(COPY.modelErrors).find(([code]) => code === cause.code)?.[1] || COPY.errors['model-request'];
        assert.ok(text.startsWith(label), cause.code);
        if (cause.message) {assert.ok(text.includes(cause.message));}
        if (typeof cause.status === 'number') {assert.ok(text.includes(COPY.providerStatus(cause.status)));}
        assert.notEqual(text, COPY.technicalFailure);
    }
    assert.equal(playerErrorText({ code: 'save-unconfirmed', status: 500 }), COPY.errors['save-unconfirmed']);
    assert.equal(playerErrorText({ code: 'local-script-failure', status: 401, message: 'private script detail' }), COPY.technicalFailure);
});

// Provider content is untrusted text, not markup. Exercise the real player
// renderer rather than only the formatter (an error must not execute HTML).
test('player result renders provider diagnostics as text without author-only details', t => {
    const { document } = parseHTML('<html><body></body></html>');
    const previous = globalThis.document; globalThis.document = document;
    t.after(() => { globalThis.document = previous; });
    const root = document.createElement('section');
    const message = '<img src=x onerror="alert(1)"> rejected';
    showDiagnostics(root, [{ code: 'model-request', cause: { code: 'vendor_error', status: 502, message } }]);
    assert.ok(root.textContent!.includes(message));
    assert.ok(root.textContent!.includes(COPY.providerStatus(502)));
    assert.equal(root.querySelector('img'), null);
    assert.equal(root.querySelector('pre'), null);
});
