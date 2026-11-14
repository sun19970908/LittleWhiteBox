import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'vite';
import { createConsoleForwardPlugin } from './vite-console-forward.mjs';

// debug-panel/README.md: skip only the forwarding frame, never real callers.
test('the browser build marks only the isolated console forwarder as ignorable', async () => {
    const root = path.resolve(import.meta.dirname, '..');
    const forward = path.join(root, 'core/console-forward.js').replaceAll('\\', '/');
    const entry = '\0console-source-test';
    const result = await build({
        configFile: false, root, logLevel: 'silent',
        plugins: [createConsoleForwardPlugin({ root }), {
            name: 'console-source-test',
            resolveId(id) { if (id === entry) return id; },
            load(id) {
                if (id === entry) return `import { createConsoleForwarder } from ${JSON.stringify(forward)}; export const run = createConsoleForwarder(console.warn.bind(console), () => false);`;
            },
        }],
        build: { write: false, minify: 'esbuild', sourcemap: false, rollupOptions: { input: entry, preserveEntrySignatures: 'strict' } },
    });
    const chunks = result.output.filter(item => item.type === 'chunk');
    const forwardChunk = chunks.find(chunk => Object.hasOwn(chunk.modules, forward));
    assert.ok(forwardChunk);
    assert.deepEqual(Object.keys(forwardChunk.modules), [forward]);
    const marker = '//# sourceMappingURL=data:application/json;base64,';
    const [generated, encoded] = forwardChunk.code.split(marker);
    assert.ok(encoded);
    const map = JSON.parse(Buffer.from(encoded.trim(), 'base64').toString('utf8'));
    assert.deepEqual(map.ignoreList, [0]);
    assert.deepEqual(map.x_google_ignoreList, [0]);
    assert.equal(map.sourcesContent.length, 1);
    assert.equal(map.sourcesContent[0].trim(), generated.trim());
    for (const chunk of chunks.filter(item => item !== forwardChunk)) {
        assert.equal(chunk.code.includes(marker), false);
    }
});
