import { executeStateOperations, decodeStoredVariable } from './executor.js';
import { getRulesSnapshot, replaceRules } from './guard-core.js';
import { bodyBlocks, parseEntry, ownedRoots, readRecords } from './records.js';
import { parseJsonInput } from './json-input.js';

/** Same executor as real intake, with detached values and no history publication. */
export function previewState({ text, input, ctx }) {
    const liveRules = getRulesSnapshot();
    const meta = structuredClone({ variables: ctx.chatMetadata?.variables || {}, LWB_RULES_V2: ctx.chatMetadata?.LWB_RULES_V2 || {} });
    meta.variables = Object.fromEntries(Object.entries(meta.variables).map(([key, value]) => [key, decodeStoredVariable(value)]));
    const entry = text === undefined ? { rules: [], ops: parseJsonInput(input) } : parseEntry(bodyBlocks(text), 'call');
    try {
        const outcome = executeStateOperations(meta, entry.rules || [], entry.ops, {
            ownedRoots: ownedRoots(readRecords(ctx.chat || [])), memory: true,
        });
        return { changes: outcome.changes, corrections: outcome.corrections, errors: outcome.errors, messages: outcome.messages,
            variables: meta.variables, rules: meta.LWB_RULES_V2 };
    } finally {
        replaceRules(liveRules);
    }
}
