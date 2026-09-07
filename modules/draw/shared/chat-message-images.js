import { getContext } from '../../../../../../extensions.js';
import { initAfterAiGate, notifyAfterAiHint, registerAfterAiHandler } from '../../../core/after-ai-gate.js';
import { xbLog } from '../../../core/debug-core.js';
import { createModuleEvents, event_types } from '../../../core/event-manager.js';
import {
    enhanceChatMessageImageTextNodes,
    resetPendingChatMessageImageSlots,
    restoreChatMessageImageSlots,
} from './chat-message-image-markup.js';

const events = createModuleEvents('chatMessageImages');
const STYLE_ID = 'xb-chat-message-image-styles';
const activeControllers = new Set();
const pendingTimers = new Set();

let imageObserver = null;
let afterAiGateDispose = null;
let initialized = false;
let lifecycleGeneration = 0;

function schedule(callback, delay) {
    const generation = lifecycleGeneration;
    const timer = globalThis.setTimeout(() => {
        pendingTimers.delete(timer);
        if (initialized && generation === lifecycleGeneration) callback();
    }, delay);
    pendingTimers.add(timer);
}

function clearPendingTimers() {
    pendingTimers.forEach(timer => globalThis.clearTimeout(timer));
    pendingTimers.clear();
}

function cancelActiveRequests() {
    activeControllers.forEach(controller => controller.abort());
    activeControllers.clear();
}

function decodeAttribute(value) {
    try {
        return decodeURIComponent(value || '');
    } catch {
        return null;
    }
}

function isAvailable() {
    const draw = window.xiaobaixDraw;
    try {
        const status = draw?.getStatus?.();
        if (status && typeof status === 'object') return status.enabled === true;
    } catch { }
    try {
        return draw?.isEnabled?.() === true;
    } catch {
        return false;
    }
}

function restoreSlots(root = document) {
    root.querySelectorAll?.('[data-xb-draw-chat-image="1"]').forEach((slot) => {
        imageObserver?.unobserve(slot);
    });
    restoreChatMessageImageSlots(root);
}

function restoreWhenUnavailable() {
    if (isAvailable()) return;
    cancelActiveRequests();
    restoreSlots();
}

function resetObserver() {
    imageObserver?.disconnect();
    imageObserver = null;
    document.querySelectorAll('[data-xb-draw-chat-image="1"][data-observed="1"]').forEach((slot) => {
        slot.dataset.observed = '';
    });
    initImageObserver();
}

function notifyAfterAi(data, source) {
    const context = getContext();
    const chatId = String(context?.chatId || '');
    const chat = context?.chat || [];
    if (!chatId || !chat.length) return;
    const messageId = source === 'generation_ended'
        ? chat.length - 1
        : (typeof data === 'object' ? data?.messageId ?? data?.id ?? data?.index ?? data?.mesId : data);
    if (!Number.isFinite(messageId) || messageId < 0 || chat[messageId]?.is_user) return;
    notifyAfterAiHint({ chatId, messageId, source, kind: 'chatMessageImages' });
}

function handleMessageChange(data) {
    schedule(() => {
        const messageId = typeof data === 'object'
            ? data?.messageId ?? data?.id ?? data?.index ?? data?.mesId
            : data;
        if (Number.isFinite(messageId)) {
            const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
            if (message) enhanceMessage(message);
            return;
        }
        processAllMessages();
    }, 100);
}

function initImageObserver() {
    if (imageObserver) return;
    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const slot = entry.target;
            imageObserver?.unobserve(slot);
            slot.dataset.observed = '';
            if (slot.dataset.loaded === '1' || slot.dataset.loading === '1') return;
            const tags = decodeAttribute(slot.dataset.tags);
            if (!tags) return;
            slot.dataset.loading = '1';
            void loadImage(slot, tags);
        });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
}

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.xb-img-slot { margin:8px 0; min-height:60px; position:relative; display:inline-block; }
.xb-img-slot img.xb-generated-img { max-width:min(400px, 80%); max-height:60vh; border-radius:4px; display:block; cursor:pointer; transition:opacity .2s; }
.xb-img-slot img.xb-generated-img:hover { opacity:.9; }
.xb-img-placeholder, .xb-img-loading { display:inline-flex; align-items:center; gap:8px; padding:12px 16px; border-radius:4px; color:#777; font-size:12px; }
.xb-img-placeholder { background:rgba(0,0,0,.04); border:1px dashed rgba(0,0,0,.15); }
.xb-img-loading { background:rgba(76,154,255,.08); border:1px solid rgba(76,154,255,.2); }
.xb-img-loading i:not(.fa-clock) { animation:fa-spin 1s infinite linear; }
.xb-img-error { display:inline-flex; flex-direction:column; align-items:center; gap:6px; padding:12px 16px; background:rgba(255,100,100,.08); border:1px dashed rgba(255,100,100,.3); border-radius:4px; color:#e57373; font-size:12px; }
.xb-img-retry { padding:4px 10px; background:rgba(255,100,100,.1); border:1px solid rgba(255,100,100,.3); border-radius:3px; color:#e57373; font-size:11px; cursor:pointer; }
.xb-img-retry:hover { background:rgba(255,100,100,.2); }
`;
    document.head.appendChild(style);
}

function enhanceMessage(container) {
    if (!container || !initialized) return;
    enhanceChatMessageImageTextNodes(container, isAvailable());
    hydrateSlots(container);
}

function processAllMessages() {
    if (!initialized) return;
    restoreWhenUnavailable();
    document.querySelectorAll('#chat .mes .mes_text').forEach(enhanceMessage);
}

function hydrateSlots(container) {
    container.querySelectorAll('[data-xb-draw-chat-image="1"]').forEach((slot) => {
        if (slot.dataset.loaded === '1' || slot.dataset.loading === '1' || slot.querySelector('img')) {
            imageObserver?.unobserve(slot);
            slot.dataset.observed = '';
            return;
        }
        if (slot.dataset.observed === '1') return;
        slot.dataset.observed = '1';
        // eslint-disable-next-line no-unsanitized/property
        slot.innerHTML = '<div class="xb-img-placeholder"><i class="fa-regular fa-image"></i><span>滚动加载</span></div>';
        imageObserver?.observe(slot);
    });
}

function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadImage(slot, tags) {
    const generation = lifecycleGeneration;
    if (!isAvailable()) return;
    // eslint-disable-next-line no-unsanitized/property
    slot.innerHTML = '<div class="xb-img-loading"><i class="fa-solid fa-spinner"></i> 检查缓存...</div>';
    const controller = new AbortController();
    activeControllers.add(controller);
    try {
        const generateSharedImage = window.xiaobaixDraw?.generateSharedImage;
        if (typeof generateSharedImage !== 'function') throw new Error('画图共享运行时未初始化');
        const base64 = await generateSharedImage({
            prompt: tags,
            cacheNamespace: 'fourth-wall',
            signal: controller.signal,
            onProgress(status, ahead) {
                if (!initialized || generation !== lifecycleGeneration || controller.signal.aborted) return;
                if (status === 'queued') {
                    // eslint-disable-next-line no-unsanitized/property
                    slot.innerHTML = ahead > 0
                        ? `<div class="xb-img-loading"><i class="fa-solid fa-clock"></i> 前方 ${ahead} 张</div>`
                        : '<div class="xb-img-loading"><i class="fa-solid fa-clock"></i> 已进入队列</div>';
                } else if (status === 'generating') {
                    // eslint-disable-next-line no-unsanitized/property
                    slot.innerHTML = '<div class="xb-img-loading"><i class="fa-solid fa-palette"></i> 生成中...</div>';
                }
            },
        });
        if (!initialized || generation !== lifecycleGeneration || controller.signal.aborted) return;
        if (!base64) throw new Error('画图结果为空');
        renderImage(slot, base64);
    } catch (error) {
        if (!initialized || generation !== lifecycleGeneration) return;
        slot.dataset.loading = '';
        if (error?.name === 'AbortError') {
            slot.dataset.observed = '';
            // eslint-disable-next-line no-unsanitized/property
            slot.innerHTML = '<div class="xb-img-placeholder"><i class="fa-regular fa-image"></i><span>滚动加载</span></div>';
            return;
        }
        slot.dataset.loaded = '1';
        // eslint-disable-next-line no-unsanitized/property
        slot.innerHTML = `<div class="xb-img-error"><i class="fa-solid fa-exclamation-triangle"></i><div>${escapeHtml(error?.message || '失败')}</div><button class="xb-img-retry" data-tags="${encodeURIComponent(tags)}">重试</button></div>`;
        bindRetryButton(slot);
    } finally {
        activeControllers.delete(controller);
    }
}

function renderImage(slot, base64) {
    slot.dataset.loaded = '1';
    slot.dataset.loading = '';
    const image = document.createElement('img');
    image.src = `data:image/png;base64,${base64}`;
    image.className = 'xb-generated-img';
    image.onclick = () => window.open(image.src, '_blank');
    // eslint-disable-next-line no-unsanitized/property
    slot.innerHTML = '';
    slot.appendChild(image);
}

function bindRetryButton(slot) {
    const button = slot.querySelector('.xb-img-retry');
    if (!button) return;
    button.onclick = (event) => {
        event.stopPropagation();
        const tags = decodeAttribute(button.dataset.tags);
        if (!tags) return;
        slot.dataset.loaded = '';
        slot.dataset.loading = '1';
        void loadImage(slot, tags);
    };
}

export function initChatMessageImages() {
    if (initialized) {
        processAllMessages();
        return true;
    }
    initialized = true;
    lifecycleGeneration += 1;
    xbLog.info('draw', 'init chat message images');
    initAfterAiGate();
    afterAiGateDispose = registerAfterAiHandler('chatMessageImages', ({ chatId, messageId }) => {
        if (String(getContext()?.chatId || '') !== String(chatId || '')) return;
        schedule(() => {
            const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
            if (message) enhanceMessage(message);
            else processAllMessages();
        }, 0);
    });
    injectStyles();
    initImageObserver();
    events.on(event_types.CHAT_CHANGED, () => {
        lifecycleGeneration += 1;
        cancelActiveRequests();
        resetPendingChatMessageImageSlots(document);
        resetObserver();
        schedule(processAllMessages, 150);
    });
    events.on(event_types.MESSAGE_RECEIVED, data => notifyAfterAi(data, 'message_received'));
    events.on(event_types.USER_MESSAGE_RENDERED, handleMessageChange);
    events.on(event_types.MESSAGE_EDITED, handleMessageChange);
    events.on(event_types.MESSAGE_UPDATED, handleMessageChange);
    events.on(event_types.MESSAGE_SWIPED, handleMessageChange);
    events.on(event_types.GENERATION_STOPPED, () => schedule(processAllMessages, 150));
    events.on(event_types.GENERATION_ENDED, data => notifyAfterAi(data, 'generation_ended'));
    processAllMessages();
    return true;
}

export function refreshChatMessageImages() {
    if (!initialized) return false;
    lifecycleGeneration += 1;
    cancelActiveRequests();
    resetPendingChatMessageImageSlots(document);
    resetObserver();
    processAllMessages();
    return true;
}

export function cleanupChatMessageImages() {
    if (!initialized && !afterAiGateDispose) return false;
    xbLog.info('draw', 'cleanup chat message images');
    initialized = false;
    lifecycleGeneration += 1;
    clearPendingTimers();
    events.cleanup();
    afterAiGateDispose?.();
    afterAiGateDispose = null;
    cancelActiveRequests();
    imageObserver?.disconnect();
    imageObserver = null;
    restoreSlots();
    document.getElementById(STYLE_ID)?.remove();
    return true;
}
