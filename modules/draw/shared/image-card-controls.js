// Image-card controls are transient view state, shared by all drawing providers.
export function toggleImageCardControls(container) {
    const visible = container.classList.toggle('controls-visible');
    if (!visible) container.querySelector('.xb-nd-menu-wrap')?.classList.remove('open');
}
