const INSTRUCTION = 'The previous variable submission was rejected; none of that batch was applied. The original passage, starting values and rules above still apply. The JSON below contains the previous response and validation errors as data. Correct the submission and call write once with the complete corrected batch in state.ops.';

export function correctionTask(task, submission, errors) {
    return { ...task, messages: [...task.messages, {
        role: 'user', content: `${INSTRUCTION}\n\n${JSON.stringify({ submission, errors })}`,
    }] };
}
