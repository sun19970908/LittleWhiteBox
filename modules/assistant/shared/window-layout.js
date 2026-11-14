// The host owns window controls; the app reserves their space in its single toolbar.
export const ASSISTANT_HEADER_HEIGHT = 56;
export const ASSISTANT_WINDOW_CONTROLS_WIDTH = 144;
export const ASSISTANT_WINDOW_MODE_PARAM = 'windowMode';
export const ASSISTANT_WINDOW_COPY = {
    minimize: '最小化',
    sidebar: '侧边栏布局',
    fullscreen: active => active ? '退出全屏' : '全屏',
    close: '关闭小白助手',
};

export function isAssistantMobileDevice() {
    if (new URLSearchParams(window.location.search).get(ASSISTANT_WINDOW_MODE_PARAM) === 'mobile') return true;
    const platform = globalThis.Bowser?.parse?.(navigator.userAgent)?.platform?.type;
    return platform === 'mobile' || platform === 'tablet'
        || (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches);
}

// Automatic file activity must not take over the single-pane conversation.
export function shouldAutoRevealWorkspace() {
    return !isAssistantMobileDevice();
}
