// The user's V5 handoff, shared by variable 2.0 and 3.0 and by the drawing planner's pattern:
// a checklist, three platform-supplied tool exchanges, then write.
export const HANDOFF = Object.freeze({
    manuscript: 'read_manuscript', guide: 'read_writing_guide', approval: 'request_write_approval', write: 'write',
});

const SYSTEM = [
    'Update the variables for the completed passage identified by target.',
    `${HANDOFF.manuscript} supplies the context assembled by SillyTavern, in its original message order. The passage to reconcile is marked <variable-update-target> inside those messages.`,
    'Character and world information include the variable-update rules. Earlier passages and recalled memories explain the situation; they are not new events to apply again.',
    `${HANDOFF.guide} supplies the managed variables and their constraints at the start of this update.`,
    `After ${HANDOFF.approval} returns approval, call ${HANDOFF.write} once with only the changes caused by the marked passage.`,
].join('\n\n');
const CHECKLIST = `> REQUIRED ACTION — EXECUTE IMMEDIATELY\n> 1. \`${HANDOFF.manuscript}\`\n> 2. \`${HANDOFF.guide}\`\n> 3. \`${HANDOFF.approval}\` — request approval for this task\n> 4. After approval, \`${HANDOFF.write}\` — submit this task’s result`;
export const APPROVAL = 'APPROVED. Proceed with `write`.';

function exchange(name, content, result) {
    const id = `variable_${name}`;
    return [
        { role: 'assistant', content, tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }] },
        { role: 'tool', tool_call_id: id, toolName: name, content: JSON.stringify(result) },
    ];
}

/**
 * Each variable mode supplies its own system prompt, manuscript, guide and write tool.
 * @returns {import('../../agent-core/public-api.js').AgentChatInput}
 */
export function buildHandoff({ systemPrompt, manuscript, guide, tools }) {
    return {
        systemPrompt,
        messages: [
            { role: 'user', content: CHECKLIST },
            ...exchange(HANDOFF.manuscript, 'First, I will read the manuscript and the current situation.', manuscript),
            ...exchange(HANDOFF.guide, 'I will now read the starting values and constraints for the managed variables.', guide),
            ...exchange(HANDOFF.approval, 'The manuscript and task requirements are clear. Requesting approval to submit this task’s result.', { approval: APPROVAL }),
        ],
        tools,
        toolChoice: 'auto',
    };
}

export function buildUpdateTask(material, schema) {
    return buildHandoff({ systemPrompt: SYSTEM, manuscript: material.context, guide: material.state,
        tools: [{ type: 'function', function: { name: HANDOFF.write,
            description: 'Submit variable changes caused by the marked target passage. The platform validates and saves them to that passage, then ends this request without a tool-result turn.',
            parameters: { type: 'object', properties: { state: schema }, required: ['state'], additionalProperties: false } } }] });
}
