export function normalizeChatMessageImageTags(value) {
    return String(value || '')
        .trim()
        .replace(/^(?:nsfw|sketchy)\s*:\s*/i, 'nsfw, ')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .join(', ');
}

export function enhanceChatMessageImageHtml(value, imageAvailable = false) {
    const source = String(value || '');
    if (!imageAvailable) return source;
    return source.replace(/\[(?:img|图片)\s*:\s*([^\]]+)\]/gi, (match, inner) => {
        const tags = normalizeChatMessageImageTags(inner);
        return tags
            ? `<div class="xb-img-slot" data-xb-draw-chat-image="1" data-marker="${encodeURIComponent(match)}" data-tags="${encodeURIComponent(tags)}"></div>`
            : match;
    });
}

export function enhanceChatMessageImageTextNodes(root, imageAvailable = false) {
    const documentTarget = root?.ownerDocument;
    if (!imageAvailable || !documentTarget?.createTreeWalker) return false;

    const textNodes = [];
    const walker = documentTarget.createTreeWalker(root, 4);
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let changed = false;
    textNodes.forEach((node) => {
        if (node.parentElement?.closest('code, pre, script, style, textarea, [data-xb-draw-chat-image="1"]')) return;
        const current = node.nodeValue || '';
        const candidates = current.matchAll(/\[(?:img|图片)\s*:\s*[^\]]+\]/gi);
        const replacement = documentTarget.createDocumentFragment();
        let cursor = 0;
        let nodeChanged = false;
        for (const candidate of candidates) {
            const marker = candidate[0];
            const enhanced = enhanceChatMessageImageHtml(marker, true);
            if (enhanced === marker) continue;
            replacement.append(documentTarget.createTextNode(current.slice(cursor, candidate.index)));
            const template = documentTarget.createElement('template');
            // Only fixed markup generated from this exact image marker is parsed as HTML.
            // eslint-disable-next-line no-unsanitized/property
            template.innerHTML = enhanced;
            replacement.append(template.content.cloneNode(true));
            cursor = candidate.index + marker.length;
            nodeChanged = true;
        }
        if (!nodeChanged) return;
        replacement.append(documentTarget.createTextNode(current.slice(cursor)));
        node.replaceWith(replacement);
        changed = true;
    });
    return changed;
}

function decodeAttribute(value) {
    try {
        return decodeURIComponent(value || '');
    } catch {
        return null;
    }
}

export function restoreChatMessageImageSlots(root) {
    const documentTarget = root?.ownerDocument || root;
    root?.querySelectorAll?.('[data-xb-draw-chat-image="1"]').forEach((slot) => {
        const marker = decodeAttribute(slot.dataset.marker);
        if (marker === null || !documentTarget?.createTextNode) return;
        slot.replaceWith(documentTarget.createTextNode(marker));
    });
}

export function resetPendingChatMessageImageSlots(root) {
    root?.querySelectorAll?.('[data-xb-draw-chat-image="1"][data-loading="1"]').forEach((slot) => {
        slot.dataset.loading = '';
        slot.dataset.observed = '';
    });
}
