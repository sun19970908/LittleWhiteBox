import { getContext } from '../../../../../../extensions.js';
import { getCardPreview, storePreview, updatePreviewRecord, setSlotSelection } from './gallery-cache.js';
import { getDrawSavedEntry, syncDrawSavedFromPreview } from './draw-common.js';
import { isSceneSlotAlive } from './scene-placement.js';
import { createImageIdentifiers } from './prepared-chat-images.js';
import { DRAW_SLOT_COPY, DRAW_SLOT_ERRORS, PreviewStatus } from './image-record.js';

// The same editor persists successful images and attempts that have no image yet.
export async function persistCardTagEdits(container, compile) {
    const slotId = container.dataset.slotId;
    const messageId = Number(container.dataset.mesid);
    const ctx = getContext();
    const message = ctx.chat[messageId];
    const panel = container.querySelector('.xb-nd-edit');
    const input = panel?.querySelector('textarea[data-type="scene"]') || panel?.querySelector('textarea');
    const tags = input?.value.trim();
    if (!tags) throw new Error(DRAW_SLOT_COPY.emptyTags);
    let record = await getCardPreview({ imgId: container.dataset.imgId, slotId });
    if (String(getContext().chatId) !== String(ctx.chatId) || ctx.chat[messageId] !== message
        || !isSceneSlotAlive(message?.mes, slotId)) throw new Error(DRAW_SLOT_COPY.sourceChanged);
    const characterPrompts = Array.isArray(record?.characterPrompts)
        ? record.characterPrompts.map((character, index) => {
            const field = panel.querySelector(`textarea[data-type="char"][data-index="${index}"]`);
            return field ? { ...character, prompt: field.value.trim() } : character;
        }) : [];
    const changes = { tags, characterPrompts, ...compile(tags, characterPrompts, record) };
    if (!record) {
        const saved = getDrawSavedEntry(message, slotId);
        const imgId = saved?.imgId || createImageIdentifiers().imgId;
        record = { imgId, slotId, messageId, chatId: String(ctx.chatId), characterName: message.name || '', ...changes,
            savedUrl: saved?.savedUrl || null, status: saved ? PreviewStatus.SUCCESS : PreviewStatus.FAILED,
            errorType: saved ? null : DRAW_SLOT_ERRORS.interrupted.label,
            errorMessage: saved ? null : DRAW_SLOT_ERRORS.interrupted.desc };
        await storePreview(record);
        await setSlotSelection(slotId, imgId);
    } else {
        record = await updatePreviewRecord(record.imgId, changes);
    }
    if (String(getContext().chatId) === String(ctx.chatId) && ctx.chat[messageId] === message && record.savedUrl) {
        await syncDrawSavedFromPreview(messageId, record);
    }
    // Do not project edits before persistence has actually succeeded.
    container.dataset.imgId = record.imgId;
    container.dataset.tags = record.tags;
    container.dataset.positive = record.positive || '';
    return record;
}
