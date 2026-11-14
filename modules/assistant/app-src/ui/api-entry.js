import { ACTIVITY_COPY as C } from './activity-copy.js';

// Open/closed is transient UI state, so the DOM is its only owner.
export function setApiPopoverOpen(root, open) {
    const popover = root?.querySelector('#xb-assistant-api-popover');
    const summary = root?.querySelector('#xb-assistant-api-summary');
    if (!popover || !summary) return;
    popover.hidden = !open;
    summary.setAttribute('aria-expanded', String(open));
}

export function renderApiSummary(root, { presetName, model }) {
    root.querySelector('#xb-assistant-api-summary-preset').textContent = presetName;
    root.querySelector('#xb-assistant-api-summary-model').textContent = model || C.modelMissing;
    const summary = root.querySelector('#xb-assistant-api-summary');
    const label = C.apiSummary(presetName, model || C.modelMissing);
    summary.title = label;
    summary.setAttribute('aria-label', label);
}

export function bindApiPopover(root) {
    const entry = root.querySelector('.xb-assistant-api-entry');
    const summary = root.querySelector('#xb-assistant-api-summary');
    const popover = root.querySelector('#xb-assistant-api-popover');
    const close = (focus = false) => {
        if (popover.hidden) return;
        setApiPopoverOpen(root, false);
        if (focus) summary.focus();
    };
    summary.addEventListener('click', () => setApiPopoverOpen(root, popover.hidden));
    root.querySelector('#xb-assistant-api-close').addEventListener('click', () => close(true));
    root.addEventListener('pointerdown', (event) => {
        if (!entry.contains(event.target)) close();
    });
    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || popover.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
    });
}
