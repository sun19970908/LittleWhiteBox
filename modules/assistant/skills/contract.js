export const COORDINATION_TOOLS = Object.freeze({
    PLAN_CREATE: 'PlanCreate', PLAN_UPDATE: 'PlanUpdate', PLAN_LIST: 'PlanList', PLAN_GET: 'PlanGet', DELEGATE_RUN: 'DelegateRun',
});
export const SKILL_MANAGEMENT_TOOLS = Object.freeze({
    GENERATE_SKILL: 'GenerateSkill', UPDATE_SKILL: 'UpdateSkill', DELETE_SKILL: 'DeleteSkill',
});

export const PLANNING_SKILL = Object.freeze({
    id: 'builtin-planning', title: '计划与分派',
    summary: 'Organize multi-step creation or research, track progress, and delegate clear independent subtasks.',
    path: 'modules/assistant/skills/planning/SKILL.md',
    tools: Object.values(COORDINATION_TOOLS),
});
export const SKILL_MANAGEMENT_SKILL = Object.freeze({
    id: 'builtin-skill-management', title: '技能管理',
    summary: 'Create a reusable skill from a completed workflow, or update or delete a skill at the user’s request.',
    path: 'modules/assistant/skills/skill-management/SKILL.md',
    tools: Object.values(SKILL_MANAGEMENT_TOOLS),
});
