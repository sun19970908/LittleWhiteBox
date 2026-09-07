import { projectionMarker, type ChatMessage } from '../application/projection.js';
import { parseImageAttachment } from '../../../domains/messages/image-attachment.js';

// DOM-lifetime only: native message updates may replace the text node's contents.
const views = new WeakMap<HTMLElement, { segmentId: string; source: string; details: HTMLDetailsElement }>();

function messageText(node: Element): string {
    const type = node.getAttribute('类型');
    return (type === 'image' ? '［图片］' : type === 'voice' ? '［语音］' : '') + (node.textContent ?? '');
}

function contactName(node: Element): string {
    return node.getAttribute(node.getAttribute('方向') === '发出' ? '接收者' : '发送者') || '联系人';
}

function renderBubble(node: Element, doc: Document): HTMLElement {
    const bubble = doc.createElement('article');
    const outgoing = node.getAttribute('方向') === '发出';
    bubble.className = outgoing ? 'xb-private-outgoing' : 'xb-private-incoming';
    bubble.setAttribute('aria-label', `${node.getAttribute('发送者') ?? ''}发给${node.getAttribute('接收者') ?? ''}`);
    const content = doc.createElement('div');
    content.textContent = messageText(node);
    if (node.getAttribute('类型') === 'image' && node.hasAttribute('附件')) {
        try {
            const attachment = parseImageAttachment({ path: node.getAttribute('附件'), name: '图片' });
            const image = doc.createElement('img');
            image.src = attachment.path;
            image.alt = outgoing ? '发送的图片' : '收到的图片';
            image.loading = 'lazy';
            content.prepend(image);
        } catch { /* Edited or untrusted paths remain readable text, never remote media. */ }
    }
    bubble.append(content);
    return bubble;
}

function renderRecord(nodes: Element[], doc: Document): HTMLDetailsElement {
    const messages = nodes.filter(node => node.tagName === '消息');
    const contacts = new Set(messages.map(contactName));
    const details = doc.createElement('details');
    details.className = 'xb-private-messages';
    details.setAttribute('aria-label', '私人信息');
    const long = messages.length > 6 || messages.reduce((length, node) => length + Array.from(messageText(node)).length, 0) > 1600;
    details.toggleAttribute('open', !long);

    const summary = doc.createElement('summary');
    const title = doc.createElement('span');
    title.className = 'xb-private-title';
    title.textContent = contacts.size === 1 ? `与${contacts.values().next().value}的通讯` : '私人通讯';
    const count = doc.createElement('span');
    count.className = 'xb-private-count';
    count.textContent = `${messages.length} 条消息`;
    const action = doc.createElement('span');
    action.className = 'xb-private-toggle';
    action.setAttribute('aria-hidden', 'true');
    const preview = doc.createElement('span');
    preview.className = 'xb-private-preview';
    const last = messages.at(-1);
    const previewText = last ? `${last.getAttribute('发送者') ?? ''}：${messageText(last)}` : '暂无消息';
    const chars = Array.from(previewText.replace(/\s+/gu, ' '));
    preview.textContent = chars.slice(0, 96).join('') + (chars.length > 96 ? '…' : '');
    summary.append(title, count, action, preview);

    const body = doc.createElement('div');
    body.className = 'xb-private-body';
    let group: HTMLElement | null = null;
    let previousContact: string | null = null;
    for (const node of nodes) {
        if (node.tagName === '补录说明') {
            const note = doc.createElement('p');
            note.className = 'xb-private-note';
            note.textContent = node.textContent;
            body.append(note);
            group = null;
            previousContact = null;
            continue;
        }
        const contact = contactName(node);
        if (!group || contact !== previousContact) {
            group = doc.createElement('section');
            group.className = 'xb-private-group';
            group.setAttribute('aria-label', `与${contact}的通讯`);
            if (contacts.size > 1) {
                const heading = doc.createElement('h4');
                heading.textContent = `与${contact}`;
                group.append(heading);
            }
            body.append(group);
            previousContact = contact;
        }
        group.append(renderBubble(node, doc));
    }
    details.append(summary, body);
    return details;
}

/** Display only: never reconstruct the sidecar from rendered markup. */
export function renderPrivateMessages(messages: readonly ChatMessage[], root: ParentNode = document): void {
    messages.forEach((message, index) => {
        const marker = projectionMarker(message);
        if (!marker || !message.mes) {return;}
        const target = root.querySelector<HTMLElement>(`.mes[mesid="${index}"] .mes_text`);
        if (!target || target.closest('.mes')?.querySelector('.edit_textarea')) {return;}
        const previous = views.get(target);
        const sameSegment = previous?.segmentId === marker.segmentId;
        if (sameSegment && previous.source === message.mes && previous.details.parentNode === target) {return;}
        const xml = new DOMParser().parseFromString(message.mes, 'application/xml');
        if (xml.querySelector('parsererror') || xml.documentElement.tagName !== '私人信息') {return;}
        const nodes = Array.from(xml.documentElement.children);
        if (nodes.some(node => node.tagName !== '消息' && node.tagName !== '补录说明')) {return;}
        const details = renderRecord(nodes, target.ownerDocument);
        if (sameSegment) {details.toggleAttribute('open', previous.details.hasAttribute('open'));}
        const focused = sameSegment && previous.details.contains(target.ownerDocument.activeElement);
        target.replaceChildren(details);
        views.set(target, { segmentId: marker.segmentId, source: message.mes, details });
        if (focused) {details.querySelector('summary')?.focus({ preventScroll: true });}
    });
}
