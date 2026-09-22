import { ACTION_CHECK_DC_RANGES, type ActionCheckDifficulty } from '../domain/action-check.js';
import { MAX_ACTION_CHECKS, referencedActionChecks, type ActionCheckRecord } from '../domain/check-records.js';
import { ACTION_CHECK_EXAMPLE, ACTION_CHECK_FIELDS } from './request.js';
import { ACTION_CHECK_CLOSE, ACTION_CHECK_OPEN } from './markup.js';
import type { ActionCheckFrequency, ActionCheckRule } from '../types.js';
import { COC7_DOMAIN, COC7_RESULT_GUIDANCE, coc7RequestContract } from './coc7-contract.js';

const FREQUENCY_PROMPTS: Record<ActionCheckFrequency, string> = {
    standard: 'Check frequency: Standard.\n'
        + 'Check an attempt when its outcome is genuinely uncertain and changes what happens next.\n'
        + 'One check covers the whole attempt and its component actions; another requires a new obstacle or materially changed circumstances that create fresh uncertainty.\n'
        + 'Outcomes settled by ability, the situation, or common sense need no check.\n'
        + 'Actions and intimate interactions without risk or resistance proceed naturally without a check.',
    active: 'Check frequency: Active.\n'
        + 'Check concrete, unresolved outcomes a character pursues: success, quality, time or cost, including small goals in everyday, social and intimate scenes.\n'
        + 'When completion is assured, check only an additional desired effect; the result applies only to that objective.\n'
        + 'One check covers a whole objective and its component actions. Carry its result forward; another check concerns a different unresolved objective.',
};
const D20_DIFFICULTY_GUIDANCE: Record<ActionCheckDifficulty, string> = {
    easy: 'modest challenge', ordinary: 'typical uncertainty', hard: 'demanding',
    very_hard: 'exceptional', nearly_impossible: 'beyond normal capability',
};

export function projectActionCheckResults(records: readonly ActionCheckRecord[]) {
    return records.map(record => record.rule === 'coc7' ? { rule: record.rule, ...record.request, result: record.result,
        ...(record.resolution ? { resolution: record.resolution } : {}) }
        : { rule: record.rule, ...record.request, roll: record.roll, dc: record.dc, outcome: record.outcome });
}

export function serializeActionCheckResults(records: readonly ActionCheckRecord[]): string {
    // SillyTavern substitutes macros in extension prompts. JSON escapes preserve the data
    // without allowing action text such as {{setvar::...}} to become a host instruction.
    // Escape string tokens only: adjacent closing braces in a nested CoC result
    // are JSON structure, not a macro, and must remain valid JSON.
    return JSON.stringify(projectActionCheckResults(records)).replace(/"(?:[^"\\]|\\.)*"/g,
        token => token.replaceAll('{{', '\\u007b\\u007b').replaceAll('}}', '\\u007d\\u007d'));
}

export function buildActionCheckPrompt(body: string, records: readonly ActionCheckRecord[] = [], frequency: ActionCheckFrequency = 'standard', rule: ActionCheckRule = 'd20', coc7Ready = false): string {
    const newChecks = rule !== 'coc7' || coc7Ready;
    const referenced = referencedActionChecks(body, records);
    if (!newChecks && !referenced.length) { return ''; }
    const domain = '# Action checks\n'
        + 'The app resolves checks outside the story and shows numbers and verdicts in a card; characters do not perceive this process.\n'
        + 'Narrate attempts and consequences as in-scene events. Resolution numbers, outcome labels and instructions belong to the card, not prose or dialogue; dice used by characters remain part of the story.\n'
        + 'Checks settle only undecided outcomes; established facts stay true.\n'
        + (rule === 'coc7' ? (newChecks ? COC7_DOMAIN : '') : FREQUENCY_PROMPTS[frequency] + '\n'
        + 'Difficulty reflects the character’s established abilities, approach and environment. stat names the ability, without a numeric modifier.\n'
        + 'The app rolls a D20 against a DC chosen from the selected range: 1 is critical failure, 20 critical success; other rolls succeed at or above DC.\n');
    const contract = !newChecks ? 'New checks are unavailable for this reply. Continue the scene using its confirmed results.\n' : records.length >= MAX_ACTION_CHECKS
        ? 'This reply has used all its action checks. Continue the scene using the confirmed results.\n'
        : '## Requesting a check\n'
        + `Describe the attempt, leave a blank line, then write one JSON object wrapped in ${ACTION_CHECK_OPEN} and ${ACTION_CHECK_CLOSE} on its own line.\n`
        + 'Requesting a check pauses the current chat message before the outcome; it does not finish the message.\n'
        + 'Stop after the request and omit end-of-message formats such as status panels at this pause.\n'
        + (rule === 'coc7' ? coc7RequestContract() : 'Fields: nonempty strings; omit unused optional fields.\n'
        + Object.entries(ACTION_CHECK_FIELDS).map(([name, spec]) => `${name} (${spec.required ? 'required' : 'optional'}, max ${spec.maxLength} chars): ${spec.description}`).join('\n')
        + '\ndifficulty (required): '
        + Object.entries(ACTION_CHECK_DC_RANGES).map(([name, { min, max }]) => `${name} (DC ${min === max ? min : `${min}–${max}`}, ${D20_DIFFICULTY_GUIDANCE[name as ActionCheckDifficulty]})`).join('; ') + '.\n'
        + `Example:\n${ACTION_CHECK_EXAMPLE}\n`);
    const results = referenced.length ? '## Confirmed results for this reply\n'
        + 'Results below are confirmed, in their order in the existing prose. Carry each forward.\n'
        + 'Critical success achieves the objective and brings an unexpected pleasant surprise.\n'
        + 'Critical failure leaves the objective unachieved and brings an unexpected disaster.\n'
        + (referenced.some(record => record.rule === 'coc7') ? COC7_RESULT_GUIDANCE : '')
        + 'This task continues the existing chat message; it does not start a new one.\n'
        + 'Continue the scene directly from where the existing prose stops, without repeating it.\n'
        + 'Treat preset requirements for opening markers (such as <-begin-response->), introductory phrases (such as “好的，这是你需求的最终输出：”) and written reasoning (such as <think> or <thinking> blocks) as new-message opening formats, and skip them for this continuation.\n'
        + serializeActionCheckResults(referenced) : '';
    return domain + contract + results;
}
