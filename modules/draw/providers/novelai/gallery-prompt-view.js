import { GALLERY_PROMPT_COPY, formatCharacterPromptsForModal } from '../../shared/gallery-prompt.js';
import { createIdentifier } from '../../../../shared/common/identifier.js';

// Closing the dialog invalidates its read. Late replies cannot fill another image.
export function createGalleryPromptView(document, post) {
    const $ = id => document.getElementById(id);
    $('nd_modal_prompt_label').textContent = GALLERY_PROMPT_COPY.title;
    $('nd_prompt_title').textContent = GALLERY_PROMPT_COPY.title;
    let pending = null;
    let imgId = null;
    const fields = ['tags', 'vibe', 'positive', 'character', 'negative', 'post'];
    const clearRequest = () => { clearTimeout(pending?.timer); pending = null; };
    const isOpen = () => $('nd_prompt_modal').classList.contains('visible');

    function status(text, failed = false) {
        $('nd_prompt_status').textContent = text;
        $('nd_prompt_status').hidden = !text;
        $('nd_prompt_retry').hidden = !failed;
    }

    function load() {
        clearRequest();
        if (document.activeElement === $('nd_prompt_retry')) $('nd_prompt_close').focus({ preventScroll: true });
        for (const field of fields) $('nd_modal_' + field).textContent = '';
        status(GALLERY_PROMPT_COPY.loading);
        const requestId = createIdentifier();
        const timer = setTimeout(() => {
            pending = null;
            status(GALLERY_PROMPT_COPY.failed, true);
        }, 15000);
        pending = { requestId, timer };
        post({ type: 'LOAD_GALLERY_PROMPT', imgId, requestId });
    }

    function close() {
        clearRequest();
        imgId = null;
        const wasOpen = isOpen();
        $('nd_prompt_modal').classList.remove('visible');
        $('nd_gallery_modal').inert = false;
        if (wasOpen) $('nd_modal_prompt').focus({ preventScroll: true });
    }

    $('nd_prompt_close').addEventListener('click', close);
    $('nd_prompt_retry').addEventListener('click', load);
    $('nd_prompt_modal').addEventListener('click', event => {
        if (event.target === $('nd_prompt_modal')) close();
    });
    $('nd_prompt_modal').addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.stopPropagation(); close(); }
        if (event.key !== 'Tab') return;
        const targets = [$('nd_prompt_close'), $('nd_prompt_content'), ...(!$('nd_prompt_retry').hidden ? [$('nd_prompt_retry')] : [])];
        const next = (targets.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
        event.preventDefault(); targets[next].focus();
    });

    return {
        open(id) {
            imgId = id;
            $('nd_prompt_modal').classList.add('visible');
            $('nd_gallery_modal').inert = true;
            $('nd_prompt_close').focus({ preventScroll: true });
            load();
        },
        close,
        isOpen,
        selected(id) { if (isOpen() && imgId !== id) close(); },
        receive(data) {
            if (!pending || data.requestId !== pending.requestId) return;
            clearRequest();
            const record = data.prompt;
            if (!record || record.imgId !== imgId) { status(GALLERY_PROMPT_COPY.failed, true); return; }
            const values = [record.tags, record.vibeNames, record.positive,
                formatCharacterPromptsForModal(record.characterPrompts), record.negativePrompt, record.postPrompt];
            fields.forEach((field, index) => { $('nd_modal_' + field).textContent = values[index] || ''; });
            status(values.some(Boolean) ? '' : GALLERY_PROMPT_COPY.empty);
        },
    };
}
