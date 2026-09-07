/** Stamp editor additions/renames at their actual save boundary, not floor zero. */
export function stampEditedCharacters(previous, characters, messageIndex) {
    if (!Number.isSafeInteger(messageIndex) || messageIndex < 0) {
        throw new Error('summary_character_edit_boundary_invalid');
    }
    const existing = new Map((previous?.main || []).map(person => [
        typeof person === 'string' ? person : person.name, person._addedAt,
    ]));
    return {
        ...characters,
        main: (characters.main || []).map(item => {
            const person = typeof item === 'string' ? { name: item } : item;
            const addedAt = existing.get(person.name);
            return {
                ...person,
                _addedAt: Number.isSafeInteger(addedAt) && addedAt >= 0 ? addedAt : messageIndex,
            };
        }),
    };
}
