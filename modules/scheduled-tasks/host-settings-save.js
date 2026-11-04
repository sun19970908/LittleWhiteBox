// 短路改造：在 TauriTavern / SillyTavern 中，直接等待宿主原生的 saveSettings 完成落盘。
// 不再劫持全局 fetch，杜绝 Response body is already used 与流克隆竞态冲突。
export async function observeHostSettingsSave(save, matches, signal) {
    await save?.();
}
