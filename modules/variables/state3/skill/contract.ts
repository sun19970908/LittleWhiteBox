import { DEFINITION_FILE } from '../definition/format.js';
import { CARD_SKILL } from '../../../card-workspace/assistant-contract.js';

export const STATE3_SKILL = Object.freeze({
    id: 'builtin-state3', title: '变量3.0规则制作',
    summary: 'Author variable 3.0 definitions and pure functions, execute isolated checks, and save the complete rule bundle through CardFiles.',
    path: 'modules/variables/state3/skill/SKILL.md',
});

export function state3SkillContent(body: string, pluginPath: string) {
    return `${body.trim()}\n\n## Instance source paths\nPlugin source root: ${pluginPath}/\nSkill directory: ${pluginPath}/modules/variables/state3/skill/\nRead these paths with project scope. Relative links resolve from the skill directory. Edit card files under the local root returned by CardFiles open.\n`;
}

export function cardWorkspaceRequest(card: { paths: string[]; root: string; name: string }, { variables = false, version, variablesMode }: { variables?: boolean; version?: string; variablesMode?: string } = {}) {
    const state3 = variables && (version ?? variablesMode) === '3.0';
    return {
        state3,
        selectedFilePath: state3
            ? card.paths.find(path => path === card.root + DEFINITION_FILE) || `${card.root}card.json`
            : card.paths.find(path => variables && path.includes('/tasks/') && path.endsWith('.js')) || `${card.root}card.json`,
        draftMessage: `帮我${variables ? state3 ? '制作变量3.0规则卡' : '制作变量卡' : '修改角色卡'}「${card.name}」。先看看已有文件，再和我一起调整。`,
        skillId: state3 ? STATE3_SKILL.id : CARD_SKILL.id,
    };
}
