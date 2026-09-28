/** Presentation only: acknowledgement never changes delivery receipts. */
export const messageSyncCopy = {
    pending: (count: number) => `${count} 条消息已保留，尚未确认写入主聊天。`,
    title: '主聊天同步',
    view: '查看',
    dismiss: '不再提示',
    setting: '未写入主聊天时提醒',
    retry: '补到主聊天',
    description: '重试不会再次发送消息或生成回复。「不再提示」不会删除消息；仍可从信息设置继续同步。',
    failed: '这次写入未完成，可以稍后重试。',
    operationTimeout: '暂时没收到操作结果，请先检查保存再重试。',
    settingsFailed: '设置未保存，请重试。',
    saveFailed: '还不能确认这次保存，请检查网络后重试。',
    saveOutdated: '原操作已经失效，不能安全重试。可以使用已保存版本；已保存的消息不会重新生成。',
    closed: '原记录已被修改、删除，或故事已继续。可以展开下方说明，在当前位置补记。',
} as const;
