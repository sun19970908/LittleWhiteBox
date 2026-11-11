export const PANEL_COPY = {
    saving: '保存中…', saved: '变量已保存', failed: '保存失败，修改仍保留在当前页面', retry: '重试保存',
    unconfirmed: '未能确认变量已保存', missingChat: '请先打开聊天',
    savedChat: name => `变量已保存到“${name}”`,
    failedChat: (name, error) => `“${name}”的变量保存失败：${error}`,
};
