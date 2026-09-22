export const TAURITAVERN_ERROR_CODES = Object.freeze({
    unsupportedFeatures: 'TT_UNSUPPORTED_MANAGED_FEATURES',
    unavailableChatSurface: 'TT_CHAT_SURFACE_UNAVAILABLE',
});

export const TAURITAVERN_MESSAGES = Object.freeze({
    unsupportedFeatures: labels => `LittleWhiteBox bounded ChatSurface does not support: ${labels.join(', ')}`,
    unavailableChatSurface: version => `TauriTavern ChatSurface participant v${version} API is unavailable`,
    decoratorCleanupFailed: 'LittleWhiteBox managed decorator mount and cleanup failed',
    customTemplateUnsupported: 'LittleWhiteBox bounded ChatSurface does not support custom template iframes',
    settingsFrozen: 'TauriTavern bounded ChatSurface 当前会话已冻结此设置；请先关闭聊天虚拟化并重新加载。',
});
