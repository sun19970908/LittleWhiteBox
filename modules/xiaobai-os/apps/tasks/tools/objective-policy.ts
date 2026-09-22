export const TASK_OBJECTIVE_POLICY = [
    'Judge objective as written, regardless of the method used. Other task fields and prior progress notes do not add completion conditions.',
    'Narrated actions and results establish progress; an unsupported claim, a plan or an inferred condition does not.',
    'An unfinished objective is not itself a failure. Failure requires an established irreversible failure or expiry.',
    'Progress records cumulative objective-related facts, without remaining-work analysis or advice.',
].join('\n');
