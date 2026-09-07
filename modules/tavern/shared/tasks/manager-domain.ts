import type { ManagerDomainFactory, ManagerPromptOptions } from '../manager/domain';
function buildTasksSection(options: ManagerPromptOptions = {}): string {
    if (options.workMode === 'manual-chat') {
        return [
            '---',
            '',
            '## Formal Tasks',
            '',
            'Current formal Phone tasks are injected as read-only context for answering the user.',
            'You have no task mutation or financial tools in manual chat. Do not claim to progress, complete, fail, settle, refund, accept, publish, withdraw, or assign a task.',
        ].join('\n');
    }
    return [
        '---',
        '',
        '## Formal Tasks',
        '',
        'Formal tasks are versioned world facts selected by the player. The injected task revision is the CAS boundary for this accepted turn.',
        '',
        'Allowed maintenance:',
        '- For a world-issued task assigned to the player, use TaskProgress / TaskComplete / TaskFail only from concrete accepted RP evidence. A character giving the fact requested by the objective is evidence; merely saying “done” is not.',
        '- For a player-issued task assigned to a world NPC, treat it as off-screen work. Conservatively assess elapsed floors, the selected assignee profile, objective and risk, prior progress, the accepted turn, and any available world state. It may progress without direct on-screen evidence, but must not change every turn by default.',
        '- Complete or fail off-screen work only when accumulated time and circumstances support a credible terminal outcome; uncertainty means progress slowly or leave unchanged.',
        '- `objective` is the one and only goal and completion target. `requirements` only constrain execution; hook, risk, prior progress, unresolved related facts, and dramatic possibilities never add goals or completion conditions.',
        '- Once accepted evidence credibly confirms the objective, use TaskComplete now. Do not preserve mystery, invent another question, or continue with TaskProgress.',
        '- Use TaskProgress only for a material change toward the unfinished objective. Its summary replaces the prior note: compress the cumulative objective-only state to at most 120 Unicode code points, containing only confirmed facts directly relevant to the objective and its exact remaining gap. Never recap dialogue, emotions, relationship movement, side plots, or the whole turn.',
        '- Treat prior `progressSummary` only as a compact note. It cannot redefine or expand the objective.',
        '',
        'Hard boundaries:',
        '- Never create or refresh task-board listings.',
        '- Never accept, publish, withdraw, or assign a task; never select or generate candidates.',
        '- Never invent account ids, payment routes, extra rewards, fees, purchases, or refunds. Complete/Fail may settle only the task escrow already owned by that formal task.',
        '- Recruiting and terminal tasks are not writable through automatic maintenance.',
        '- If evidence is ambiguous or nothing materially changed, skip the task tools.',
    ].join('\n');
}

export const tasksManagerDomain: ManagerDomainFactory = (_preset, options) => ({
    title: 'Formal Tasks',
    injected: [options.workMode === 'manual-chat' ? 'Current formal Phone tasks, read-only.' : 'Tasks visible at the accepted source assistant floor, including ids and revisions.'],
    reads: [],
    tools: options.workMode === 'manual-chat' ? [] : ['TaskProgress / TaskComplete / TaskFail — maintain an existing active task and its existing escrow.'],
    focus: 'Player work follows accepted evidence. NPC work has the explicit off-screen assessment policy below; elapsed floors are opportunities to assess, not proof of in-world time or progress.',
    prompt: buildTasksSection(options),
});
