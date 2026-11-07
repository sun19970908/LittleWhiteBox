import { getTools, SUBMIT_TOOL } from './tools.js';
import { buildUpdateView } from './views.js';
import { HANDOFF } from '../../updater/preset.js';
import type { Compiled, Json, Diagnostic } from '../types.js';
import type { AgentChatInput, AgentChatResult, AgentHistoryMessage, PublicAgentSession } from '../../../agent-core/public-api.js';

export function buildUpdateTask(compiled: Compiled, state: Json, context: unknown): AgentChatInput {
    const exchange = (name: string, value: unknown): AgentHistoryMessage[] => {
        const id = 'variable3_' + name;
        return [
            { role: 'assistant', content: '', tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }] },
            { role: 'tool', tool_call_id: id, toolName: name, content: JSON.stringify(value) },
        ];
    };
    return {
        systemPrompt: [
            'Update the variables for the completed passage marked <variable-update-target>.',
            'read_manuscript supplies the context assembled by SillyTavern in its original order. Earlier passages and recalled memories explain the situation; they are not new events to apply again.',
            'read_writing_guide supplies the starting state, writable fields, actions and rules. Its values already exclude the previous submission for this passage.',
            'Field descriptions explain direct edits; action descriptions explain complete behaviours. The settlement computes derived values and explicit corrections.',
            'After request_write_approval approves this task, call write once with the changes caused by the marked passage. An empty state array records no changes.',
        ].join('\n\n'),
        messages: [
            { role: 'user', content: 'Read the manuscript, read the writing guide, request approval, then submit the changes for this passage.' },
            ...exchange(HANDOFF.manuscript, context),
            ...exchange(HANDOFF.guide, buildUpdateView(compiled, state)),
            ...exchange(HANDOFF.approval, { approved: true, submit: SUBMIT_TOOL }),
            { role: 'user', content: 'The platform has supplied the materials and approval above. Submit the changes for the marked passage.' },
        ],
        tools: getTools(compiled), toolChoice: 'auto',
    };
}
export function correctionMessages(response: Pick<AgentChatResult, 'reply' | 'toolCalls'>, diagnostics: Diagnostic[], toolResult: PublicAgentSession['toolResult']): AgentHistoryMessage[] {
    return [response.reply, ...response.toolCalls.map(call =>
        toolResult(call, JSON.parse(JSON.stringify({ accepted: false, diagnostics, stateUnchanged: true })))),
    { role: 'user', content: 'Revise the rejected submission using the same marked passage and starting state. Submit the complete replacement once.' }];
}
