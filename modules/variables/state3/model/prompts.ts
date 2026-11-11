import { getTools } from './tools.js';
import { buildUpdateView } from './views.js';
import { buildHandoff } from '../../updater/handoff.js';
import type { Compiled, Json, UpdateStage } from '../types.js';
import type { AgentChatInput } from '../../../agent-core/public-api.js';

export function buildUpdateTask(compiled: Compiled, state: Json, context: unknown, stage: UpdateStage = 'after'): AgentChatInput {
    return buildHandoff({
        systemPrompt: [
            stage === 'before'
                ? 'Resolve the player action marked <variable-update-target> before the story reply is written. Use the card rules to determine its outcome.'
                : 'Update the variables for the completed story reply marked <variable-update-target>.',
            'read_manuscript supplies the context assembled by SillyTavern in its original order. Earlier passages and recalled memories explain the situation; they are not new events to apply again.',
            'read_writing_guide supplies the state at this update, writable fields and actions assigned to this stage, and the shared rules and triggers.',
            ...(stage === 'after' ? ['When beforeUpdate is supplied with the manuscript, it describes this turn’s already settled player action. Its effects are already in the supplied state. Apply only additional events in the story reply.'] : []),
            'Each field description explains its meaning; its update text, when present, says when and how to change it. Action descriptions explain complete behaviours.',
            'Actions apply their described effects; settlement computes derived values, corrections and trigger effects automatically. Submit each event through its action or direct edits, leaving those automatic effects to settlement. Separate events may change the same field.',
            'For numeric changes or changes requiring judgement, add a short reason identifying the supporting passage event. Straightforward factual updates need no restatement. Include old only when explicitly comparing the prior value helps explain the change; copying whole objects or arrays adds no useful comparison.',
            'After request_write_approval returns approval, call write once with only the changes caused by the marked passage.',
        ].join('\n\n'),
        manuscript: context, guide: buildUpdateView(compiled, state, stage), tools: getTools(compiled, stage),
    });
}

export function beforeProsePrompt(outcome: unknown): string {
    return [
        'The JSON below records the part of the latest user message already resolved before this reply; everything else in that message remains open for this reply.',
        'Keep what happens in this reply consistent with this outcome. The current state shown elsewhere in this context already includes these changes.',
        'This block is reference data for generating the reply; raw JSON, field paths and outcome labels are not part of the reply.',
        'applied means the listed actions and changes took effect; rejected means the attempted action did not pass the pre-reply check. diagnostics records the reasons it did not pass.',
    ].join(' ') + '\n' + JSON.stringify(outcome);
}
