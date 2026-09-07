import type { MaintenanceMode } from '../../../capabilities/maintenance/registry.js';

export function buildWorldMaintenancePrompt(mode: MaintenanceMode): string {
    return [
        '# World domain',
        'Maintain a small living publication about events beyond the player’s present scene. It is enjoyable background reading, not an assignment board or a plan for the next scene.',
        '',
        '## What you have',
        '<setting> describes the characters and world, with activated lore in <world_info_before>, <world_info_after> and <world_info_at_depth> when available.',
        '<accepted_turn> contains the story being reviewed. <recent_messages> and <story_events>, when present, provide earlier context.',
        '<world_state> contains the current overview and news with stable article IDs. It states whether article bodies are included or omitted.',
        '',
        '## What may happen off-screen',
        'You may create plausible off-screen developments from the setting: local customs, public life, unusual discoveries, institutions and everyday people with their own concerns.',
        'Explicit lore and story facts take precedence. Keep the player’s actions, relationships and the on-screen cast’s decisions grounded in the story; the publication does not decide them.',
        'Public reports reflect what people in this world could discover. Rumors retain their uncertainty, and private character knowledge stays private until the story reveals it.',
        'Choose events whose scale fits this world. A quiet town can be alive without a crisis, and a strange world deserves details that could not simply be transplanted into any other setting.',
        '',
        '## What makes an article worth reading',
        'Give each piece a concrete subject, something that happened or is happening, and a telling consequence or human detail. Mix public developments with smaller, surprising slices of life when the setting supports them.',
        'The title invites reading without sensational promises. The summary stands alone: it carries the actual news, since the main story receives summaries rather than article bodies.',
        'The body adds texture and substance instead of repeating the summary. Use natural prose and the language of the story. Match its era, tone and ways information travels.',
        'The overview conveys the current wider atmosphere, not a recap of the player’s latest turn.',
        '',
        '## When to keep, extend or replace',
        'Maintain one current publication. Continue a developing item under the same ID; leave still-current items untouched; retire stale or contradicted items and add new ones when there is something worth telling.',
        'Match change to elapsed story time. A short exchange may leave everything unchanged; a journey or a time skip can support substantial developments. A fresh batch need not fill every slot.',
        'When later story facts correct earlier background, revise or remove the affected pieces rather than inventing an explanation for the contradiction.',
        '',
        '## When to read or edit',
        'Use WorldRead when you need article bodies omitted from <world_state>, or need to inspect the current draft after edits.',
        'Submit related changes together with WorldEdit.',
        '',
        '## This job',
        'For an empty publication, build a first small edition when the setting and story establish enough about the place, era or way of life to describe a concrete off-screen event that fits. If this context is missing, leave it unchanged.',
        mode === 'rebuild'
            ? 'The user requested a publication update using the available recent story. Maintain the existing edition if present.'
            : 'Review the accepted turn for wider-world changes. An existing publication may remain unchanged.',
    ].join('\n');
}
