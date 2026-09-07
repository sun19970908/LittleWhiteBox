import type { MaintenanceStatus } from '../../../capabilities/maintenance/runner.js';
import type { XiaobaiOsFileState } from '../../../kernel/contracts.js';
import { providerFailureMessage } from '../../../capabilities/agent/provider-failure.js';

export function worldSkippedMessage(reason: string): string {
    switch (reason) {
        case 'no-usable-messages':
        case 'no-complete-assistant': return '等待故事开场后，再获取世界新闻。';
        case 'generation-active': return '角色正在回复，等这次对话结束后再刷新。';
        case 'chat-unavailable': return '请先进入聊天。';
        case 'no-work': return '这次没有需要更新的新闻。';
        default: return '这次未能开始更新，请稍后重试。';
    }
}

export function worldStatusMessage(write: XiaobaiOsFileState, status: MaintenanceStatus, pendingSave = false): string {
    switch (write) {
        case 'loading': return '正在读取本期内容…';
        case 'saving': return '正在确认保存，原有内容仍可阅读。';
        case 'unconfirmed': return '保存结果尚未确认。请先核实保存，不要重复生成。';
        case 'conflict': return '保存的版本不一致。请先读取服务器版本，再继续更新。';
        case 'failed': return pendingSave
            ? '核实保存未完成，待保存内容仍保留。请检查存储连接后再次核实，不要重复生成。'
            : '暂时无法读取已保存的内容，请重试读取。';
    }
    if (status.state === 'running') { return '正在采集世界近况，原有内容仍可阅读…'; }
    if (status.message === 'updated') { return '本期内容已更新。'; }
    if (status.message === 'unchanged') { return '已查看世界近况，本期内容依然适用。'; }
    if (status.message === 'cancelled') { return '本次更新已取消，原有内容保留。'; }
    if (status.message === 'skipped') { return worldSkippedMessage(status.reason); }
    if (status.state !== 'error' && status.message !== 'failed') { return ''; }
    const detail: Record<string, string> = {
        'agent-not-configured': '请先在 API 应用中配置模型和所需的密钥。',
        'config-load-failed': '未能读取模型配置，请在 API 应用中检查。',
        'agent-session-failed': '未能连接模型，请检查 API 配置。',
        'empty-provider-response': '模型没有返回内容，可以稍后重试。',
        'tool-errors-unresolved': '模型提交的内容未通过检查，可以重试。',
        'round-limit': '本次处理未能完成，可以稍后继续更新。',
        'background-capture-failed': '未能读取世界背景，请确认聊天已加载。',
        'session-creation-failed': '未能读取当前新闻，请重试读取。',
        'save-unconfirmed': '保存尚待核实，请先核实保存结果。',
        'save-failed': '保存未完成，请检查存储连接后重试。',
    };
    return '本次更新未完成。' + (providerFailureMessage(status.reason)
        || detail[status.reason] || '请稍后重试；持续失败时可查看控制台诊断。');
}
