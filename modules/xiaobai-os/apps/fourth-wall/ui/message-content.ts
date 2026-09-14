import { renderMarkdownToHtml } from '../../../../agent-core/ui/message-markdown.js';

export interface FourthWallMediaSegment {
    kind: 'image' | 'voice';
    raw: string;
    value: string;
    emotion?: string;
}

export type FourthWallContentNode =
    | { kind: 'text'; value: string }
    | { kind: 'media'; index: number }
    | { kind: 'element'; tag: string; attrs: Record<string, string>; children: FourthWallContentNode[] };

export interface FourthWallContent {
    nodes: FourthWallContentNode[];
    media: FourthWallMediaSegment[];
}

const TEXT_TAGS = new Set([
    'p', 'br', 'em', 'i', 'strong', 'b', 'del', 's', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a',
]);
const OMIT_TAGS = new Set(['script', 'style', 'custom-style', 'iframe', 'object', 'embed', 'svg', 'math']);

/** A display-only projection. Saved text and media payloads are never rewritten. */
export function parseFourthWallContent(source: string, document: Document = globalThis.document): FourthWallContent {
    const media: FourthWallMediaSegment[] = [];
    const marker = `XB4W${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('')}MEDIA`;
    // Protect media payloads from Markdown, then only activate markers outside code/links.
    const protectedText = source.replace(
        /\[(?:img|图片)\s*:\s*([^\]]+)\]|\[(?:voice|语音)\s*:([^:\]]*):([^\]]+)\]|\[(?:voice|语音)\s*:\s*([^\]]+)\]/gi,
        (raw: string, image: string | undefined, emotion: string | undefined, voice: string | undefined, plainVoice: string | undefined, offset: number) => {
            let slashes = 0;
            for (let index = offset - 1; index >= 0 && source[index] === '\\'; index--) { slashes++; }
            if (slashes % 2) { return raw; }
            media.push(image !== undefined
                ? { kind: 'image', raw, value: image.trim() }
                : { kind: 'voice', raw, value: String(voice ?? plainVoice ?? '').trim(), emotion: String(emotion || '').trim().toLowerCase() });
            return `${marker}${media.length - 1}END`;
        },
    );
    const markerPattern = new RegExp(`${marker}(\\d+)END`, 'g');
    const restore = (value: string) => value.replace(markerPattern, (_, index: string) => media[Number(index)].raw);

    function textNodes(value: string, inert: boolean): FourthWallContentNode[] {
        if (inert) { return [{ kind: 'text', value: restore(value) }]; }
        const result: FourthWallContentNode[] = [];
        let cursor = 0;
        for (const match of value.matchAll(markerPattern)) {
            if (match.index > cursor) { result.push({ kind: 'text', value: value.slice(cursor, match.index) }); }
            result.push({ kind: 'media', index: Number(match[1]) });
            cursor = match.index + match[0].length;
        }
        if (cursor < value.length) { result.push({ kind: 'text', value: value.slice(cursor) }); }
        return result;
    }

    function project(node: Node, inert = false): FourthWallContentNode[] {
        if (node.nodeType === 3) { return textNodes(node.textContent || '', inert); }
        if (node.nodeType !== 1) { return []; }
        const element = node as Element;
        const tag = element.localName;
        if (OMIT_TAGS.has(tag)) { return []; }
        // External Markdown images remain their alt text; generated images use the APP's media cards.
        if (tag === 'img') { return [{ kind: 'text', value: restore(element.getAttribute('alt') || '') }]; }
        const children = Array.from(element.childNodes).flatMap(child => project(child, inert || ['code', 'pre', 'a'].includes(tag)));
        if (!TEXT_TAGS.has(tag)) { return children; }
        const attrs: Record<string, string> = {};
        if (tag === 'a') {
            const href = restore(element.getAttribute('href') || '').trim();
            if (!/^(?:https?:\/\/|mailto:)/i.test(href)) { return children; }
            attrs.href = href;
            attrs.target = '_blank';
            attrs.rel = 'noopener noreferrer';
            if (element.hasAttribute('title')) { attrs.title = restore(element.getAttribute('title')!); }
        }
        if (tag === 'ol' && /^\d+$/.test(element.getAttribute('start') || '')) { attrs.start = element.getAttribute('start')!; }
        return [{ kind: 'element', tag, attrs, children }];
    }

    // The shared renderer sanitizes HTML. The inert template plus the explicit tag/attribute
    // projection also keep this APP safe without a host DOMPurify global; no raw HTML is mounted.
    const template = document.createElement('template');
    // eslint-disable-next-line no-unsanitized/property -- inert parse only; project() allowlists all mounted nodes/attributes
    template.innerHTML = renderMarkdownToHtml(protectedText, { htmlFenceMode: 'code' });
    return { nodes: Array.from(template.content.childNodes).flatMap(node => project(node)), media };
}
