import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { outputRoot } from './build/output-root.mjs';
import { root } from './build/browser-entries.mjs';
import { packageLicenseSupplement } from './build/license-supplements.mjs';

const directory = path.join(outputRoot, 'dist/tools');
const result = await build({
    absWorkingDir: root, entryPoints: ['modules/variables/state3/offline/entry.ts'],
    outfile: path.join(directory, 'state3.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node18',
    // The Node runner uses the same QuickJS VM directly; it has no browser Worker.
    define: { 'globalThis.Worker': 'undefined', 'globalThis.window': 'undefined', 'import.meta.url': 'undefined' },
    minify: true, supported: { 'template-literal': false }, legalComments: 'eof', metafile: true,
});
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
for (const output of Object.values(result.metafile.outputs)) for (const item of output.imports) {
    if (item.external && !builtins.has(item.path)) throw new Error(`Offline tool requires unbundled package: ${item.path}`);
}
const packages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.startsWith('node_modules/')) continue;
    let directory = path.dirname(path.join(root, input));
    while (!fs.existsSync(path.join(directory, 'package.json'))) directory = path.dirname(directory);
    packages.add(directory);
}
const licenses = [...packages].sort().map(directory => {
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const files = fs.readdirSync(directory).filter(name => /^(?:license|licence|copying)(?:\.|$)/i.test(name));
    const supplements = files.length ? [] : packageLicenseSupplement(metadata) || [];
    if (!files.length && !supplements.length) throw new Error(`Missing license: ${metadata.name}`);
    return [metadata.name + '@' + metadata.version, 'License: ' + metadata.license,
        ...files.map(file => fs.readFileSync(path.join(directory, file), 'utf8')),
        ...supplements.map(file => file.name + '\n' + file.text)].join('\n\n');
});
fs.writeFileSync(path.join(directory, 'state3-LICENSES.txt'), licenses.join('\n\n---\n\n') + '\n');
