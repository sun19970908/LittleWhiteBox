import { CARD_SKILL } from '../../../card-workspace/assistant-contract.js';

export const STATE2_SKILL = Object.freeze({
    id: 'builtin-state2', title: '变量2.0制作',
    summary: 'Author or maintain variable 2.0 cards: gameplay state and conditions, $schema and initial values, model-visible state and gameplay facts, update instructions and front-end integration; save through CardFiles.',
    path: 'modules/variables/state2/skill/SKILL.md',
    tools: CARD_SKILL.tools,
});

export function state2SkillContent(body, pluginPath) {
    return `${body.trim()}\n\n## Instance source paths\nPlugin source root: ${pluginPath}/\nSkill directory: ${pluginPath}/modules/variables/state2/skill/\nRead these paths with project scope. Relative links resolve from the directory of the document containing them; drop any #anchor before reading the file. Edit card files under the local root returned by CardFiles open.\n`;
}
