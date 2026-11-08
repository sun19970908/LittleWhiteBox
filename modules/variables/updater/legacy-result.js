// Retire the prototype's redundant receipts at chat load, including inactive
// swipes. No replacement format: history comes from the existing operation log.
// Remove this cleanup when chats written by that prototype are no longer supported.
const LEGACY_RESULT_KEY = 'LittleWhiteBox_variableUpdate';

export function removeLegacyResults(chat) {
    let changed = false;
    for (const message of chat) {
        for (const holder of [message, ...(message.swipe_info || [])]) {
            if (holder.extra && Object.hasOwn(holder.extra, LEGACY_RESULT_KEY)) {
                delete holder.extra[LEGACY_RESULT_KEY];
                changed = true;
            }
        }
    }
    return changed;
}
