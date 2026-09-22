export function isMessageInRenderWindow(settings, mesid, chatLength) {
    const max = settings.maxRenderedMessages;
    if (!Number.isFinite(max) || max <= 0) return true;
    return mesid >= Math.max(0, chatLength - max);
}

export function claimIframeRuntimes({
    content,
    claims,
    settings,
    shouldRender,
    mountRuntime,
    mesid,
    chatLength,
}) {
    if (!settings.enabled || settings.renderEnabled === false) return;
    if (!isMessageInRenderWindow(settings, mesid, chatLength)) return;

    for (const code of content.querySelectorAll('pre > code')) {
        if (shouldRender(code)) {
            claims.claim(code.parentElement, mountRuntime);
        }
    }
}
