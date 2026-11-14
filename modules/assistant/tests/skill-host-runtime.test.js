import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { parse } from 'acorn';
import { BUILTIN_SKILLS, skillCatalogLine } from '../shared/skill-tools.js';

// Contract: memory/skill refresh payloads keep builtin skill IDs and their tool mappings,
// including cross-referenced summaries and an unreadable user catalog (cost: hidden activation entry points).
async function loadSkillsRuntime(catalogResult) {
    const source = await readFile(new URL('../assistant.js', import.meta.url), 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const declaration = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'readSkillsRuntimeData');
    const moduleSource = `export default function(readSkillsCatalogData, normalizeSkillsCatalog, EMPTY_SKILLS_CATALOG,
        BUILTIN_SKILLS, skillCatalogLine, buildMemoryNoteWorkspacePath) {
        ${source.slice(declaration.start, declaration.end)}
        return readSkillsRuntimeData;
    }`;
    // eslint-disable-next-line no-unsanitized/method -- Execute actual local host code, never user input.
    const { default: createRuntime } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
    return createRuntime(async () => catalogResult, value => value, { version: 1, skills: [] },
        BUILTIN_SKILLS, skillCatalogLine, () => '');
}

for (const ok of [true, false]) test(`host skill refresh preserves builtin machine IDs and declared tools (user catalog ok=${ok})`, async () => {
    const catalog = { version: 1, skills: [] };
    const readRuntime = await loadSkillsRuntime(ok
        ? { ok: true, catalog, summaryText: 'user-skill-fixture' }
        : { ok: false, message: 'fixture_catalog_error' });
    const result = await readRuntime();
    const lines = result.skillsPromptSummary.split('\n');
    for (const skill of BUILTIN_SKILLS) {
        const entries = lines.filter(line => line === skillCatalogLine(skill));
        assert.equal(entries.length, 1, skill.id);
        const tokens = new Set(entries[0].match(/[A-Za-z0-9_-]+/g) || []);
        assert.ok(tokens.has(skill.id), skill.id);
        for (const name of skill.tools) assert.ok(tokens.has(name), `${skill.id}: ${name}`);
    }
    assert.deepEqual(result.skillsCatalog, catalog);
    assert.deepEqual(result.skillFiles, []);
    assert.equal(result.skillsCatalogError, ok ? '' : 'fixture_catalog_error');
    if (ok) assert.ok(lines.includes('user-skill-fixture'));
});
