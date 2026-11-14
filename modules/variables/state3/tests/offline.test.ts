import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runCommand } from '../offline/command.js';
import { readBundle, writeDirectory } from '../offline/files.js';
import { readCard, writeCard } from '../offline/card.js';
import { equipmentExample } from '../definition/example.js';
import { CARD_EXTENSION, DEFINITION_FILE } from '../definition/format.js';
import { compileDefinition } from '../definition/compile.js';
import { initialize, settle } from '../engine/settle.js';
import { accepted } from './fixture.js';

// Frozen SillyTavern 1.18 character-card-parser.write output: 1px RGBA + V2/V3.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgZGL+DwABFAEG1rmmRQAAAMJ0RVh0Y2hhcmEAZXlKemNHVmpJam9pWTJoaGNtRmZZMkZ5WkY5Mk1pSXNJbk53WldOZmRtVnljMmx2YmlJNklqSXVNQ0lzSW1SaGRHRWlPbnNpYm1GdFpTSTZJazltWm14cGJtVWdabWw0ZEhWeVpTSXNJbVJsYzJOeWFYQjBhVzl1SWpvaWEyVmxjQ0lzSW1WNGRHVnVjMmx2Ym5NaU9uc2libVZwWjJoaWIzSWlPbnNpYTJWbGNDSTZkSEoxWlgxOWZYMD1OIPPPAAAAwXRFWHRjY3YzAGV5SnpjR1ZqSWpvaVkyaGhjbUZmWTJGeVpGOTJNeUlzSW5Od1pXTmZkbVZ5YzJsdmJpSTZJak11TUNJc0ltUmhkR0VpT25zaWJtRnRaU0k2SWs5bVpteHBibVVnWm1sNGRIVnlaU0lzSW1SbGMyTnlhWEIwYVc5dUlqb2lhMlZsY0NJc0ltVjRkR1Z1YzJsdmJuTWlPbnNpYm1WcFoyaGliM0lpT25zaWEyVmxjQ0k2ZEhKMVpYMTlmWDA9UY8k7QAAAABJRU5ErkJggg==', 'base64');

// O1: external authoring round-trips all sources without changing other card data.
// Cost: silently losing rules, card text or other extensions.
test('O1: directory, JSON and host PNG carry the same complete package', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'state3-offline-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const project = path.join(directory, 'project');
    assert.equal((await runCommand(['init', project])).ok, true);
    const bundle = await readBundle(project);
    bundle.definition.functions.identity = { reads: [], description: 'Identity' }; bundle.functions.identity = '([value]) => value';
    bundle.definition.extensions = { tools: { info: { title: 'Info', description: 'Info', enabled: false, stages: [], parameters: {} } },
        scripts: { prepare: { title: 'Prepare', description: 'Prepare', enabled: false } } };
    bundle.tools = { info: 'return { value: 1 };' }; bundle.scripts = { prepare: 'return { value: 2 };' };
    const sources = path.join(directory, 'sources'); await writeDirectory(sources, bundle);
    for (const extension of ['.json', '.png']) {
        const original = path.join(directory, 'original' + extension), output = path.join(directory, 'packed' + extension);
        const bytes = extension === '.png' ? png : Buffer.from(JSON.stringify(readCard(png, '.png')));
        await writeFile(original, bytes);
        assert.equal((await runCommand(['pack', sources, original, output])).ok, true);
        assert.deepEqual(await readFile(original), bytes);
        assert.deepEqual(await readBundle(output), bundle);
        const oldCard = readCard(bytes, extension), next = readCard(await readFile(output), extension);
        delete (next.data as { extensions: Record<string, unknown> }).extensions[CARD_EXTENSION];
        assert.deepEqual(next, oldCard);
        const unpacked = path.join(directory, 'unpacked' + extension);
        assert.equal((await runCommand(['unpack', output, unpacked])).ok, true);
        assert.deepEqual(await readBundle(unpacked), bundle);
        if (extension === '.png') {
            const packed = await readFile(output);
            // All image bytes before card metadata remain identical.
            assert.deepEqual(packed.subarray(0, 58), png.subarray(0, 58));
            for (const key of ['chara', 'ccv3']) {
                const offset = packed.indexOf(Buffer.from(key + '\0'));
                const length = packed.readUInt32BE(offset - 8) - key.length - 1;
                const card = JSON.parse(Buffer.from(packed.toString('ascii', offset + key.length + 1, offset + key.length + 1 + length), 'base64').toString('utf8'));
                assert.deepEqual(JSON.parse(card.data.extensions[CARD_EXTENSION]), bundle);
            }
        }
    }
});

// O2: offline check/try use browser settlement semantics and never run host code.
// Cost: shipping invalid rules or executing external side effects during a check.
test('O2: offline checks all openings and trials match the shared engine, including functions', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'state3-trial-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const bundle = equipmentExample();
    bundle.definition.functions.base = { reads: [], description: 'Base health' }; bundle.functions.base = '() => 60';
    bundle.definition.rules.find(rule => rule.id === 'base-health')!.value = { call: 'base', args: [] };
    const source = path.join(directory, 'rules.json'), input = path.join(directory, 'input.json');
    const operations = [{ action: 'unequip', params: {} }];
    await writeFile(source, JSON.stringify(bundle)); await writeFile(input, JSON.stringify(operations));
    assert.equal((await runCommand(['check', source])).ok, true);
    const compiled = compileDefinition(bundle), start = accepted(await initialize(compiled));
    assert.deepEqual(await runCommand(['try', source, input]), await settle(compiled, start.state, operations));
    bundle.definition.extensions = { scripts: {
        prepare: { title: 'Prepare', description: 'Prepare', enabled: true },
        calculate: { title: 'Calculate', description: 'Calculate', enabled: true },
        committed: { title: 'Committed', description: 'Committed', enabled: true },
    } };
    bundle.scripts = { prepare: 'throw new Error("host side effect");', committed: 'throw new Error("host side effect");',
        calculate: '() => [{op:"inc",path:["hero","health"],delta:-1}]' };
    await writeFile(source, JSON.stringify(bundle));
    assert.equal((await runCommand(['check', source])).ok, true);
    const extended = await runCommand(['try', source, input]);
    assert.equal(extended.ok, true);
    assert.equal('state' in extended && (extended.state as { hero: { health: number } }).hero.health, 59);
    bundle.definition.openings = [{}, { hero: { health: -5 } }];
    await writeFile(source, JSON.stringify(bundle));
    const invalid = await runCommand(['check', source]);
    assert.equal(invalid.ok, false);
    assert.equal('diagnostics' in invalid && invalid.diagnostics?.[0].opening, 1);
});

// O3: output failures, malformed packages and unknown versions leave inputs and
// existing outputs intact. Cost: irreversible author-file loss or corrupt cards.
test('O3: failed checks and existing outputs never overwrite authored files', async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'state3-output-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const project = path.join(directory, 'project');
    assert.equal((await runCommand(['init', project])).ok, true);
    const card = path.join(project, 'card.json'), original = await readFile(card);
    assert.equal((await runCommand(['pack', project, card, card])).ok, false);
    assert.equal((await runCommand(['init', project])).ok, false);
    assert.deepEqual(await readFile(card), original);
    const bundle = await readBundle(project); bundle.definition.format = 999;
    await writeFile(path.join(project, DEFINITION_FILE), JSON.stringify(bundle.definition));
    const output = path.join(directory, 'invalid.json');
    assert.equal((await runCommand(['pack', project, card, output])).ok, false);
    await assert.rejects(readFile(output), { code: 'ENOENT' });
    await mkdir(path.join(project, 'variables/functions'));
    await writeFile(path.join(project, 'variables/functions/invalid name.js'), '() => 1');
    assert.equal((await runCommand(['check', project])).ok, false);
    assert.throws(() => writeCard(Buffer.from('broken'), '.png', equipmentExample()));
    const damaged = Buffer.from(png); damaged[45] ^= 1;
    assert.throws(() => readCard(damaged, '.png'));
});
