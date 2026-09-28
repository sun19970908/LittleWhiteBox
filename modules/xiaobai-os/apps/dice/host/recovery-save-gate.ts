/** Native message controls only; reading, scrolling and the composer remain usable. */
const CONTROLS = '#chat .mes_buttons, #chat .mes_edit_buttons, #chat .swipe_left, #chat .swipe_right, #chat .swipes-counter, #chat .mes_reasoning_edit, #chat .mes_reasoning_edit_done, #chat .mes_reasoning_delete, #chat .mes_media_delete, #chat .mes_img_swipe_left, #chat .mes_img_swipe_right, #option_delete_mes, #dialogue_del_mes_ok';
const CLASS_NAME = 'xb-dice-saving-chat';

/** Owned by the native save Promise, never by animation or generation cancellation. */
export function holdDiceRecoverySave(current: () => boolean, doc: Document = document): () => void {
    const held = new Map<Element, { inert: boolean; aria: string | null }>();
    const style = doc.createElement('style');
    style.textContent = `.${CLASS_NAME} { opacity: .45; cursor: wait; }`;
    doc.head.append(style);
    const restore = () => {
        for (const [element, previous] of held) {
            element.toggleAttribute('inert', previous.inert);
            if (previous.aria === null) { element.removeAttribute('aria-disabled'); }
            else { element.setAttribute('aria-disabled', previous.aria); }
            element.classList.remove(CLASS_NAME);
        }
        held.clear();
    };
    const update = () => {
        if (!current()) { restore(); return; }
        for (const element of doc.querySelectorAll(CONTROLS)) {
            if (held.has(element)) { continue; }
            held.set(element, { inert: element.hasAttribute('inert'), aria: element.getAttribute('aria-disabled') });
            element.setAttribute('inert', '');
            element.setAttribute('aria-disabled', 'true');
            element.classList.add(CLASS_NAME);
        }
    };
    const block = (event: Event) => {
        if (!current()) { return; }
        const element = event.target instanceof doc.defaultView!.Element ? event.target as Element : null;
        let conflict = !!element?.closest(CONTROLS);
        if (event.type === 'keydown') {
            const { key, ctrlKey, shiftKey, altKey, metaKey } = event as KeyboardEvent;
            const input = element?.closest('input, textarea, [contenteditable="true"]');
            const composer = doc.querySelector<HTMLTextAreaElement>('#send_textarea');
            conflict ||= key === 'ArrowUp' && !(ctrlKey && shiftKey) && input === composer && composer?.value === ''
                || (key === 'ArrowLeft' || key === 'ArrowRight') && !input && !(ctrlKey || shiftKey || altKey || metaKey);
        } else if (event.type.startsWith('swiped-')) { conflict = !!element?.closest('#chat'); }
        if (conflict) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const events = ['click', 'keydown', 'swiped-left', 'swiped-right'];
    for (const name of events) { doc.addEventListener(name, block, true); }
    // Native click-to-edit is delegated to document and invokes jQuery directly,
    // bypassing the edit button's inert state. Stop only its bubbling leg after
    // content/card handlers run; preserve selection and default link/details actions.
    const chat = doc.getElementById('chat');
    const blockTextEdit = (event: Event) => {
        if (current() && event.target instanceof doc.defaultView!.Element
            && (event.target as Element).closest('.mes_text, .mes_reasoning')) { event.stopPropagation(); }
    };
    chat?.addEventListener('click', blockTextEdit);
    // TT virtualizes historical floors; newly mounted native controls share the same gate.
    const observer = new doc.defaultView!.MutationObserver(update);
    observer.observe(doc.body, { childList: true, subtree: true });
    update();
    return () => {
        observer.disconnect();
        for (const name of events) { doc.removeEventListener(name, block, true); }
        chat?.removeEventListener('click', blockTextEdit);
        restore(); style.remove();
    };
}
