// The user's V5 handoff: three platform-supplied tool exchanges, then write.
export const HANDOFF = Object.freeze({
    manuscript: 'read_manuscript', guide: 'read_writing_guide', approval: 'request_write_approval', write: 'write',
});

export const PRESET_FIELDS = Object.freeze([
    { key: 'system', label: '身份与任务', role: 'system', text: [
        'Update the variables for the completed passage identified by target.',
        `${HANDOFF.manuscript} supplies the context assembled by SillyTavern, in its original message order. The passage to reconcile is marked <variable-update-target> inside those messages.`,
        'Character and world information include the variable-update rules. Earlier passages and recalled memories explain the situation; they are not new events to apply again.',
        `${HANDOFF.guide} supplies the managed variables and their constraints at the start of this update.`,
        `After ${HANDOFF.approval} returns approval, call ${HANDOFF.write} once with only the changes caused by the marked passage. An empty ops array records that this passage makes no changes.`,
    ].join('\n\n') },
    { key: 'checklist', label: '执行清单', role: 'user', text: `> REQUIRED ACTION — EXECUTE IMMEDIATELY\n> 1. \`${HANDOFF.manuscript}\`\n> 2. \`${HANDOFF.guide}\`\n> 3. \`${HANDOFF.approval}\` — request approval for this task\n> 4. After approval, \`${HANDOFF.write}\` — submit this task’s result` },
    { key: 'readContext', label: '读取前情与资料', role: 'assistant', tool: HANDOFF.manuscript, text: 'First, I will read the manuscript and the current situation.' },
    { key: 'readRules', label: '读取变量与约束', role: 'assistant', tool: HANDOFF.guide, text: 'I will now read the starting values and constraints for the managed variables.' },
    { key: 'askApproval', label: '申请提交', role: 'assistant', tool: HANDOFF.approval, text: 'The manuscript and task requirements are clear. Requesting approval to submit this task’s result.' },
    { key: 'approval', label: '确认提交', role: 'tool', text: 'APPROVED. Proceed with `write`.' },
]);

export function defaultPreset() { return Object.fromEntries(PRESET_FIELDS.map(field => [field.key, field.text])); }

export function buildUpdateTask(preset, material, schema) {
    const message = key => ({ role: PRESET_FIELDS.find(field => field.key === key).role, content: preset[key] });
    const exchange = (key, result) => {
        const name = PRESET_FIELDS.find(field => field.key === key).tool;
        const id = `variable_${name}`;
        return [
            { ...message(key), tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }] },
            { role: 'tool', tool_call_id: id, content: JSON.stringify(result) },
        ];
    };
    return {
        systemPrompt: preset.system,
        messages: [message('checklist'), ...exchange('readContext', material.context),
            ...exchange('readRules', material.state), ...exchange('askApproval', { approval: preset.approval })],
        tools: [{ type: 'function', function: { name: HANDOFF.write,
            description: 'Submit variable changes caused by the marked target passage. The platform validates and saves them to that passage, then ends this request without a tool-result turn.',
            parameters: { type: 'object', properties: { state: schema }, required: ['state'], additionalProperties: false } } }],
        toolChoice: 'auto',
    };
}
