export const REPLY_PROGRESS_SETTINGS = Object.freeze({
    key: 'replyProgress',
    controlId: 'xiaobaix_reply_progress_enabled',
    label: '生成状态追踪',
    defaultEnabled: true,
});

export function prepareReplyProgressSettings(settings) {
    const value = settings[REPLY_PROGRESS_SETTINGS.key] ??= {};
    value.enabled ??= REPLY_PROGRESS_SETTINGS.defaultEnabled;
    return value;
}
