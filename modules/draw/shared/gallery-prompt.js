// Read-only projection of the chosen image, never of the current presets.
export function projectGalleryPrompt(record) {
    if (!record) return null;
    const { imgId, tags, vibeNames, positive, characterPrompts, negativePrompt, postPrompt } = record;
    return { imgId, tags, vibeNames, positive, characterPrompts, negativePrompt, postPrompt };
}

export const GALLERY_PROMPT_COPY = Object.freeze({
    title: '查看提示词',
    loading: '正在读取提示词…',
    failed: '提示词读取失败，请重试。',
    empty: '这张图片没有保存提示词。',
    character: index => `角色 ${index + 1}`,
    negative: value => `负向：${value}`,
});

export function formatCharacterPromptsForModal(prompts) {
    if (!Array.isArray(prompts)) return '';
    return prompts.map((character, index) => {
        const parts = [character.prompt, character.uc ? GALLERY_PROMPT_COPY.negative(character.uc) : ''].filter(Boolean);
        return `${character.name || GALLERY_PROMPT_COPY.character(index)}: ${parts.join('\n')}`;
    }).join('\n\n');
}
