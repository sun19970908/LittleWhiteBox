import { docsUrl } from './docs-url.js';

const CALLS = Object.freeze({ draw: 'window.parent.xiaobaixDraw.generate(request)', tts: 'window.parent.xiaobaixTts.synthesize(text, options)' });
const ANCHORS = Object.freeze({ draw: '画图', tts: '语音' });
const COPY = Object.freeze({ before: '也可通过 ', after: ' 调用，', link: '详见文档' });

export function mountMediaApiHint(root, kind) {
    const code = root.ownerDocument.createElement('code');
    code.textContent = CALLS[kind];
    code.style.overflowWrap = 'anywhere';
    code.style.whiteSpace = 'normal';
    code.style.fontSize = '1em';
    const link = root.ownerDocument.createElement('a');
    link.textContent = COPY.link;
    link.href = docsUrl('media-api', ANCHORS[kind]);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.color = 'var(--accent, currentColor)';
    root.replaceChildren(COPY.before, code, COPY.after, link);
}
