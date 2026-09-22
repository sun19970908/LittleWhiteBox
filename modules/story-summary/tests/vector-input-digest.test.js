import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { inputDigest } from '../vector/utils/vector-input-digest.js';

function verifyDigests(digest) {
    const texts = [
        '', 'hello', '候鸟迁徙。🕊️\n河岸恢复平静。', 'a\u0000b\r\n"\\',
        '\u00e9', 'e\u0301', '\ud800',
        ...[55, 56, 63, 64, 65, 1000].map(length => '文'.repeat(length)),
    ];
    for (const kind of ['chunk', 'state', 'relation', 'event']) {
        for (const text of texts) {
            // Persisted ZIP/cache protocol: algorithm, UTF-8 encoding and JSON framing.
            const expected = createHash('sha256').update(JSON.stringify([kind, text]), 'utf8').digest('hex');
            assert.equal(digest(kind, text), expected);
        }
    }
}

test('native digest module preserves stored SHA-256 values without a host library', () => {
    verifyDigests(inputDigest);
});

test('browser digest runs without host exports, Node globals or Web Crypto', async () => {
    const bundle = await build({
        entryPoints: [fileURLToPath(new URL('../vector/utils/vector-input-digest.js', import.meta.url))],
        bundle: true, write: false, format: 'iife', globalName: 'digestModule',
        platform: 'browser', packages: 'external', target: 'es2020',
    });
    const browser = { window: {} };
    // Execute the shipped dependency in an isolated browser-like environment.
    // External npm imports stay external, so bundling cannot silently supply them.
    runInNewContext(bundle.outputFiles[0].text, browser, { timeout: 1000 });
    verifyDigests(browser.digestModule.inputDigest);
});
