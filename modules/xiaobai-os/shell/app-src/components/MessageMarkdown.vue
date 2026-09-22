<script setup lang="ts">
import { ref, watch } from 'vue';
import { enhanceMarkdownCodeBlocks, renderMarkdownToHtml } from '../../../../agent-core/ui/message-markdown.js';

const props = defineProps<{ text: string }>();
const surface = ref<HTMLElement | null>(null);
const tags = new Set(['p', 'br', 'em', 'i', 'strong', 'b', 'del', 's', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a']);
const omitted = new Set(['script', 'style', 'custom-style', 'iframe', 'object', 'embed', 'svg', 'math']);

watch([surface, () => props.text], () => {
    if (!surface.value) { return; }
    const template = document.createElement('template');
    // Text replies allow Markdown, not generated apps or remote media.
    // eslint-disable-next-line no-unsanitized/property -- mounted elements/attributes are allowlisted below
    template.innerHTML = renderMarkdownToHtml(props.text, { htmlFenceMode: 'code' });
    for (const element of template.content.querySelectorAll('*')) {
        const tag = element.localName;
        if (omitted.has(tag)) { element.remove(); continue; }
        if (tag === 'img') { element.replaceWith(document.createTextNode(element.getAttribute('alt') ?? '')); continue; }
        if (!tags.has(tag)) { element.replaceWith(...element.childNodes); continue; }
        const href = element.getAttribute('href') ?? '';
        const start = element.getAttribute('start') ?? '';
        for (const attribute of [...element.attributes]) { element.removeAttribute(attribute.name); }
        if (tag === 'a' && /^(?:https?:\/\/|mailto:)/i.test(href)) {
            element.setAttribute('href', href); element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer');
        }
        if (tag === 'ol' && /^\d+$/.test(start)) { element.setAttribute('start', start); }
    }
    enhanceMarkdownCodeBlocks(template.content, { codeBlockClassName: 'os-markdown-codeblock', codeCopyClassName: 'os-markdown-code-copy' });
    surface.value.replaceChildren(template.content);
}, { flush: 'post' });
</script>

<template><div ref="surface" class="os-message-markdown" /></template>

<style>
.os-message-markdown { min-width: 0; overflow-wrap: anywhere; }
.os-message-markdown > :first-child { margin-top: 0; }
.os-message-markdown > :last-child { margin-bottom: 0; }
.os-message-markdown > * + * { margin-top: 12px; }
.os-message-markdown :is(ul, ol) { padding-left: 1.5em; }
.os-message-markdown blockquote { border-left: 2px solid var(--markdown-rule); padding-left: 14px; color: var(--markdown-muted); margin-left: 0; margin-right: 0; }
.os-message-markdown :is(h1, h2, h3, h4, h5, h6) { font-size: 1.1em; line-height: 1.6; }
.os-message-markdown table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.os-message-markdown :is(td, th) { padding: 6px 10px; border: 1px solid var(--markdown-rule); }
.os-message-markdown pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--markdown-tint); border-radius: 6px; padding: 12px; margin: 0; }
.os-message-markdown code { font: .9em/1.7 monospace; }
.os-message-markdown a { color: var(--markdown-accent); text-decoration: underline; }
.os-markdown-codeblock { position: relative; padding-top: 38px; background: var(--markdown-tint); border-radius: 6px; }
.os-markdown-code-copy { position: absolute; top: 0; right: 0; }
</style>
