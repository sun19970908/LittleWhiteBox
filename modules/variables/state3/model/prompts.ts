import { getTools } from './tools.js';
import { buildUpdateView } from './views.js';
import { buildHandoff } from '../../updater/handoff.js';
import type { Compiled, Json } from '../types.js';
import type { AgentChatInput } from '../../../agent-core/public-api.js';

export function buildUpdateTask(compiled: Compiled, state: Json, context: unknown): AgentChatInput {
    return buildHandoff({
        systemPrompt: [
            'Update the variables for the completed passage marked <variable-update-target>.',
            'read_manuscript supplies the context assembled by SillyTavern in its original order. Earlier passages and recalled memories explain the situation; they are not new events to apply again.',
            'read_writing_guide supplies the state before the marked passage, writable fields, actions, rules and triggers.',
            'Each field description explains its meaning; its update text, when present, says when and how to change it. Action descriptions explain complete behaviours.',
            'Actions apply their described effects; settlement computes derived values, corrections and trigger effects automatically. Submit each event through its action or direct edits, leaving those automatic effects to settlement. Separate events may change the same field.',
            'Give each item a reason: one short sentence naming the event in the marked passage that supports it. Players read these reasons beside the result.',
            'After request_write_approval returns approval, call write once with only the changes caused by the marked passage.',
        ].join('\n\n'),
        manuscript: context, guide: buildUpdateView(compiled, state), tools: getTools(compiled),
    });
}
