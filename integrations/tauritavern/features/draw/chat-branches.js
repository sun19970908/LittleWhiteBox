// TauriTavern 2.3 cold swipes keep inactive branch text as null until hydrated.
// This is a host storage contract, not a drawing tag or migration format.
// Fixed host-owned module URL, never derived from chat data or user settings.
// eslint-disable-next-line no-unsanitized/method
const loadChatPayloadHost = () => import(new URL('../../../../../../../chat-payload-transport.js', import.meta.url).href);

export async function prepareTauriTavernDrawBranches(ctx, loadHost = loadChatPayloadHost) {
    const messages = ctx.chat.filter(message => message?.tt_swipe_cold);
    if (messages.length === 0) return;
    const { hydrateMessageSwipes } = await loadHost();
    for (const message of messages) await hydrateMessageSwipes(message);
}
