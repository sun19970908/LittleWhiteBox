import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// O6: the distributed tool runs without source or node_modules; its failure
// status prevents invalid delivery. Cost: broken external authoring protocol.
test('O6: installed standalone tool creates, checks, tries, packs and unpacks with meaningful exit status', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'state3-distribution-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const executable = path.join(directory, 'state3.cjs');
    fs.copyFileSync(new URL('../../../../dist/tools/state3.cjs', import.meta.url), executable);
    const run = (...args) => {
        const result = spawnSync(process.execPath, [executable, ...args], { cwd: directory, encoding: 'utf8', timeout: 30000 });
        if (result.error) throw result.error;
        assert.ok(result.stdout, result.stderr);
        return { status: result.status, value: JSON.parse(result.stdout) };
    };
    assert.equal(run('init', 'project').status, 0);
    const file = path.join(directory, 'project/variables/definition.json');
    const definition = JSON.parse(fs.readFileSync(file, 'utf8'));
    definition.functions.base = { reads: [], description: 'Base health' };
    definition.rules.find(rule => rule.id === 'base-health').value = { call: 'base', args: [] };
    fs.writeFileSync(file, JSON.stringify(definition));
    fs.mkdirSync(path.join(directory, 'project/variables/functions'));
    fs.writeFileSync(path.join(directory, 'project/variables/functions/base.js'), '() => 60');
    assert.equal(run('check', 'project').status, 0);
    fs.writeFileSync(path.join(directory, 'actions.json'), JSON.stringify([{ action: 'unequip', params: {} }]));
    const trial = run('try', 'project', 'actions.json');
    assert.equal(trial.status, 0); assert.equal(trial.value.state.hero.health, 60);
    assert.equal(run('pack', 'project', 'project/card.json', 'ready.json').status, 0);
    assert.equal(run('unpack', 'ready.json', 'unpacked').status, 0);
    assert.deepEqual(run('check', 'unpacked').value, run('check', 'project').value);
    const original = fs.readFileSync(path.join(directory, 'ready.json'));
    assert.equal(run('pack', 'project', 'project/card.json', 'ready.json').status, 1);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'ready.json')), original);
    definition.format = 999; fs.writeFileSync(file, JSON.stringify(definition));
    const failed = run('check', 'project');
    assert.equal(failed.status, 1); assert.equal(failed.value.ok, false);
});
