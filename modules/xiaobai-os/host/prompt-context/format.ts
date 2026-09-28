import type { PromptContextSnapshot } from './types.js';

export function escapePromptData(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/{/g, '&#123;')
        .replace(/}/g, '&#125;');
}

function characterBlock(character: PromptContextSnapshot['characters'][number]): string {
    return [
        '  <character>',
        `    <name>${escapePromptData(character.displayName)}</name>`,
        character.description ? `    <description>${escapePromptData(character.description)}</description>` : '',
        character.personality ? `    <personality>${escapePromptData(character.personality)}</personality>` : '',
        character.scenario ? `    <scenario>${escapePromptData(character.scenario)}</scenario>` : '',
        '  </character>',
    ].filter(Boolean).join('\n');
}

export function buildPromptSettingBlock(
    context: PromptContextSnapshot,
    { economyScale = '' }: { readonly economyScale?: string } = {},
): string {
    return [
        '<setting>',
        '以下是人物与世界背景资料。',
        economyScale ? `<economy_scale>\n${escapePromptData(economyScale)}\n</economy_scale>` : '',
        '<player>',
        `  <name>${escapePromptData(context.player.displayName)}</name>`,
        context.player.persona ? `  <persona>${escapePromptData(context.player.persona)}</persona>` : '',
        '</player>',
        ...(context.characters.length ? [
            '<characters>',
            ...context.characters.map(characterBlock),
            '</characters>',
        ] : []),
        context.characterNote ? `<character_note>${escapePromptData(context.characterNote)}</character_note>` : '',
        context.exampleDialogue ? `<example_dialogue>${escapePromptData(context.exampleDialogue)}</example_dialogue>` : '',
        context.worldInfo.before
            ? `<world_info_before>\n${escapePromptData(context.worldInfo.before)}\n</world_info_before>`
            : '',
        context.worldInfo.after
            ? `<world_info_after>\n${escapePromptData(context.worldInfo.after)}\n</world_info_after>`
            : '',
        context.worldInfo.depth.length
            ? `<world_info_at_depth>\n${context.worldInfo.depth.map(escapePromptData).join('\n\n')}\n</world_info_at_depth>`
            : '',
        context.worldInfo.extras?.exampleBefore.length
            ? `<world_info_example_before>\n${context.worldInfo.extras.exampleBefore.map(escapePromptData).join('\n\n')}\n</world_info_example_before>`
            : '',
        context.worldInfo.extras?.exampleAfter.length
            ? `<world_info_example_after>\n${context.worldInfo.extras.exampleAfter.map(escapePromptData).join('\n\n')}\n</world_info_example_after>`
            : '',
        context.worldInfo.extras?.authorNoteBefore.length
            ? `<world_info_author_note_before>\n${context.worldInfo.extras.authorNoteBefore.map(escapePromptData).join('\n\n')}\n</world_info_author_note_before>`
            : '',
        context.worldInfo.extras?.authorNoteAfter.length
            ? `<world_info_author_note_after>\n${context.worldInfo.extras.authorNoteAfter.map(escapePromptData).join('\n\n')}\n</world_info_author_note_after>`
            : '',
        '</setting>',
    ].filter(Boolean).join('\n');
}

function recentMessagesBlock(messages: PromptContextSnapshot['recentMessages']): string {
    if (!messages.length) {return '';}
    return [
        '<recent_messages>',
        ...messages.map(message => [
            `  <message role="${message.role}" speaker="${escapePromptData(message.speakerName)}">`,
            escapePromptData(message.text),
            '  </message>',
        ].join('\n')),
        '</recent_messages>',
    ].join('\n');
}

export function buildPromptCurrentStateBlock(
    context: PromptContextSnapshot,
    { additionalSections = [] }: { readonly additionalSections?: readonly string[] } = {},
): string {
    const sections = [
        context.storyEvents
            ? `<story_events>\n${escapePromptData(context.storyEvents)}\n</story_events>`
            : '',
        ...additionalSections,
        recentMessagesBlock(context.recentMessages),
    ].filter(section => typeof section === 'string' && section.length > 0);
    return [
        '<current_state>',
        '以下是截至捕获边界的剧情背景，只用于理解当前处境，不是本次需要续写的剧情正文。',
        ...sections,
        '</current_state>',
    ].join('\n');
}
