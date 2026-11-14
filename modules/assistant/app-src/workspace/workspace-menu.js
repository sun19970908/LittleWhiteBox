// A single floating menu for workspace buttons. It lives outside the panel
// containers so panel re-renders never reset it; open state is DOM-only.
let activeMenu = null;

// Panel re-renders keep keyed buttons in place but may remove the anchor.
export function isWorkspaceMenuOpen(key) {
    return activeMenu?.key === key;
}

export function closeDetachedWorkspaceMenu() {
    if (activeMenu && !activeMenu.anchor.isConnected) closeWorkspaceMenu();
}

export function closeWorkspaceMenu() {
    if (!activeMenu) return;
    const { element, anchor, cleanup } = activeMenu;
    activeMenu = null;
    cleanup();
    element.remove();
    anchor.setAttribute('aria-expanded', 'false');
}

function placeMenu(menu, anchor) {
    const view = anchor.ownerDocument.defaultView;
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth, height = menu.offsetHeight, gap = 4, margin = 8;
    const left = Math.min(Math.max(margin, rect.right - width), view.innerWidth - width - margin);
    const below = rect.bottom + gap;
    const top = below + height <= view.innerHeight - margin ? below : Math.max(margin, rect.top - gap - height);
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${top}px`;
}

/**
 * @param {HTMLElement} anchor
 * @param {string} key stable identity of the anchor across panel re-renders
 * @param {{ label: string, hint?: string, danger?: boolean, disabled?: boolean, onSelect: () => void }[]} items
 */
export function toggleWorkspaceMenu(anchor, key, items) {
    const reopening = activeMenu?.key === key;
    closeWorkspaceMenu();
    if (reopening || !items.length) return;
    const document = anchor.ownerDocument;
    const menu = document.createElement('div');
    menu.className = 'xb-assistant-workspace-menu';
    menu.setAttribute('role', 'menu');
    for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        button.className = `xb-assistant-workspace-menu-item${item.danger ? ' is-danger' : ''}`;
        button.disabled = !!item.disabled;
        const label = document.createElement('span');
        label.textContent = item.label;
        button.appendChild(label);
        if (item.hint) {
            const hint = document.createElement('small');
            hint.textContent = item.hint;
            button.appendChild(hint);
        }
        button.onclick = () => {
            closeWorkspaceMenu();
            item.onSelect();
        };
        menu.appendChild(button);
    }
    document.body.appendChild(menu);
    placeMenu(menu, anchor);
    anchor.setAttribute('aria-expanded', 'true');

    const onPointerDown = event => {
        if (!menu.contains(event.target) && !anchor.contains(event.target)) closeWorkspaceMenu();
    };
    const onKeyDown = event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        closeWorkspaceMenu();
        anchor.focus();
    };
    const onViewportChange = event => {
        if (!menu.contains(event.target)) closeWorkspaceMenu();
    };
    const view = document.defaultView;
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('scroll', onViewportChange, true);
    view.addEventListener('resize', closeWorkspaceMenu);
    activeMenu = {
        element: menu, anchor, key,
        cleanup: () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('scroll', onViewportChange, true);
            view.removeEventListener('resize', closeWorkspaceMenu);
        },
    };
    menu.querySelector('button:not(:disabled)')?.focus();
}
