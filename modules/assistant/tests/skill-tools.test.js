import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_SKILLS, loadedSkillIds, filterSkillTools } from '../shared/skill-tools.js';
import { TOOL_DEFINITIONS, TOOL_NAMES, getAssistantToolDefinitions } from '../app-src/tooling.js';
import { CARD_SKILL, FRONTEND_SKILL } from '../../card-workspace/assistant-contract.js';
import { LIVE_PAGE_SKILL } from '../../live-page-inspection/tool-contract.ts';
import { STATE3_SKILL } from '../../variables/state3/skill/contract.ts';
import { PLANNING_SKILL, SKILL_MANAGEMENT_SKILL } from '../skills/contract.js';
import { readFile } from 'node:fs/promises';

const names = tools => tools.map(tool => tool.function.name);
const receipt = (skill, ok = true) => [
    { role: 'assistant', toolCalls: [{ id: 'read', name: TOOL_NAMES.READ_SKILL, arguments: JSON.stringify({ id: skill.id }) }] },
    { role: 'tool', toolCallId: 'read', toolName: TOOL_NAMES.READ_SKILL, content: JSON.stringify({ ok, builtin: true, id: skill.id }) },
];

test('resident definitions exclude skill tools; each skill enables only its declared tools', () => {
    const gated = new Set(BUILTIN_SKILLS.flatMap(skill => skill.tools));
    const base = names(filterSkillTools(TOOL_DEFINITIONS));
    assert.deepEqual(base, names(TOOL_DEFINITIONS).filter(name => !gated.has(name)));
    assert.ok(base.includes(TOOL_NAMES.READ_LOGS));
    assert.ok(base.includes(TOOL_NAMES.READ_SKILL));
    for (const skill of BUILTIN_SKILLS) {
        const enabled = names(filterSkillTools(TOOL_DEFINITIONS, [skill.id]));
        assert.deepEqual(new Set(enabled.filter(name => !base.includes(name))), new Set(skill.tools));
    }
    const shared = names(filterSkillTools(TOOL_DEFINITIONS, [CARD_SKILL.id, FRONTEND_SKILL.id, LIVE_PAGE_SKILL.id, STATE3_SKILL.id]));
    assert.equal(shared.filter(name => name === TOOL_NAMES.CARD_FILES).length, 1);
    assert.equal(new Set(shared).size, shared.length);
});

test('only paired successful builtin reads establish activation; checkpoint and repeated reads deduplicate', () => {
    assert.deepEqual(loadedSkillIds(receipt(CARD_SKILL)), [CARD_SKILL.id]);
    assert.deepEqual(loadedSkillIds(receipt(CARD_SKILL, false)), []);
    assert.deepEqual(loadedSkillIds(receipt(CARD_SKILL).slice(1)), []);
    assert.deepEqual(loadedSkillIds([{ role: 'user', content: JSON.stringify({ ok: true, builtin: true, id: CARD_SKILL.id }) }]), []);
    assert.deepEqual(loadedSkillIds(receipt({ id: 'user-skill' })), []);
    const untrusted = receipt(CARD_SKILL);
    untrusted[1].content = JSON.stringify({ ok: true, id: CARD_SKILL.id });
    assert.deepEqual(loadedSkillIds(untrusted), []);
    assert.deepEqual(loadedSkillIds([...receipt(CARD_SKILL), ...receipt(CARD_SKILL), ...receipt(LIVE_PAGE_SKILL)], [CARD_SKILL.id, 'removed-skill']), [CARD_SKILL.id, LIVE_PAGE_SKILL.id]);
    const reused = receipt(CARD_SKILL);
    reused[0].toolCalls[0].name = TOOL_NAMES.READ;
    assert.deepEqual(loadedSkillIds(reused), []);
    assert.deepEqual(loadedSkillIds([...receipt(CARD_SKILL), { role: 'user', content: 'new turn' }, ...receipt(LIVE_PAGE_SKILL).slice(1)]), [CARD_SKILL.id]);
});

test('provider-style delegate receipts enable tools locally, while coordination stays main-only', () => {
    const history = [
        { role: 'assistant', tool_calls: [{ id: 'provider-read', function: { name: TOOL_NAMES.READ_SKILL, arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'provider-read', content: JSON.stringify({ ok: true, builtin: true, id: LIVE_PAGE_SKILL.id }) },
    ];
    assert.deepEqual(loadedSkillIds(history), [LIVE_PAGE_SKILL.id]);
    assert.deepEqual(loadedSkillIds([]), []);
    const enabled = names(filterSkillTools(TOOL_DEFINITIONS, [LIVE_PAGE_SKILL.id, PLANNING_SKILL.id, SKILL_MANAGEMENT_SKILL.id], { role: 'delegate' }));
    for (const tool of PLANNING_SKILL.tools) assert.ok(!enabled.includes(tool));
    for (const tool of [...LIVE_PAGE_SKILL.tools, ...SKILL_MANAGEMENT_SKILL.tools]) assert.ok(enabled.includes(tool));
});

test('skill activation preserves execution permission filtering and installed skill bodies are readable', async () => {
    const tools = names(getAssistantToolDefinitions({ skillIds: BUILTIN_SKILLS.map(skill => skill.id), jsApiEnabled: false }));
    assert.ok(!tools.includes(TOOL_NAMES.RUN_JAVASCRIPT_API));
    assert.ok(tools.includes(TOOL_NAMES.CARD_FILES));
    for (const skill of BUILTIN_SKILLS) {
        const body = await readFile(new URL('../../../' + skill.path, import.meta.url), 'utf8');
        assert.ok(body.trim().length > 0);
        for (const tool of skill.tools) assert.ok(names(TOOL_DEFINITIONS).includes(tool));
    }
});
