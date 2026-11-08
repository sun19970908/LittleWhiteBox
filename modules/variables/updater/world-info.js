export const UPDATE_RULES_PREFIX = '【小白X变量更新】';

/** Only the current capture's lore arrays change; saved entries stay disabled. */
export function exposeUpdateRules({ eventSource, eventTypes }) {
    const loaded = ({ globalLore, characterLore, chatLore, personaLore }) => {
        for (const entries of [globalLore, characterLore, chatLore, personaLore]) {
            entries.forEach((entry, index) => {
                if (entry.disable === true && entry.comment?.startsWith(UPDATE_RULES_PREFIX)) {
                    entries[index] = { ...entry, disable: false };
                }
            });
        }
    };
    eventSource.on(eventTypes.WORLDINFO_ENTRIES_LOADED, loaded);
    return () => eventSource.removeListener(eventTypes.WORLDINFO_ENTRIES_LOADED, loaded);
}
