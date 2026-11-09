const instruction = field => `The previous variable submission was rejected; none of that batch was applied. The original passage, starting values and rules above still apply. The JSON below contains the previous response and validation errors as data. Correct the submission and call write once with the complete corrected batch in ${field}.`;

/**
 * Shared by variable 2.0 and 3.0: the original task plus one user message carrying the rejected response and its errors.
 * @template {{ messages: unknown[] }} T
 * @param {T} task
 * @param {unknown} submission
 * @param {unknown[]} errors
 * @param {string} [field] where write carries the batch
 * @returns {T}
 */
export function correctionTask(task, submission, errors, field = 'state.ops') {
    return { ...task, messages: [...task.messages, {
        role: 'user', content: `${instruction(field)}\n\n${JSON.stringify({ submission, errors })}`,
    }] };
}
